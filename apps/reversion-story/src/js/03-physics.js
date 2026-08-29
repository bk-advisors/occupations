/* ============================================================================
   RTM PHYSICS  ·  a small 2D particle engine for balls, pegs and bins.

   Why hand rolled: the page ships as one file with zero external requests, so
   there is no room for a physics library, and we only need one shape (a disc)
   against three static primitives (disc, segment, box wall).

   DESIGN NOTES

   Fixed timestep. Real elapsed time goes into an accumulator and the solver
   only ever advances by a constant dt (1/120 s). Catch up steps are capped, so
   a backgrounded tab that returns after 40 seconds does not try to simulate 40
   seconds in one frame and lock the page. Everything a caller schedules should
   be keyed to the step counter, never to wall time: that is what makes a run
   reproducible at any frame rate.

   Deterministic. All randomness comes from RTM.rng(seed). Never Math.random().
   Same seed plus same step count gives the same pixels, which is the only way
   this thing can be screenshotted and regression tested.

   Integrator. Semi implicit (symplectic) Euler: velocity first, then position.
   Stable under gravity, cheap, and it does not pump energy into a resting pile
   the way explicit Euler does.

   Collisions. Impulse response along the contact normal with a restitution
   term, plus Coulomb friction along the tangent, plus Baumgarte style
   positional correction with a slop band so resting contacts do not vibrate.
   Two solver iterations per substep, which is enough for a pile ten deep.

   Broadphase. Uniform grid spatial hash, rebuilt each substep, 3x3 neighbour
   query. Pegs live in their own static grid built once. Hundreds of balls stay
   linear; the naive all pairs version janks past about 120.

   Tunnelling. Inside each fixed step the solver takes as many substeps as it
   needs so that no particle moves more than about half its own radius. Capped
   at 6.

   Sleeping. A particle whose speed stays under a threshold for N consecutive
   steps stops being integrated. Without this a pile jitters forever and looks
   cheap. Three details earned by testing rather than by theory:

     - Waking is decided by impact speed, never by penetration depth. A soft
       constraint solver always leaves overlap at the bottom of a loaded stack,
       and a penetration test reads that as a fresh collision every step, so
       the bottom row of the tallest pile never sleeps.
     - Restitution is switched off below restCut. One step of gravity is about
       10 px/s, so a resting ball bounces on its own weight every step and
       never gets slow enough to qualify.
     - contactDamp bleeds the residual velocity that positional correction
       leaves behind, but only for a particle already touching two things.
       Flight is untouched.

   With all three, 120 balls settle in about 1400 steps. With none of them they
   never settle at all.

   API

     var w = RTM.physics.world({
       gravity, damping, restitution, friction,
       bounds: {x0, y0, x1, y1},        // y1 is the floor, x0/x1 are walls
       seed,                            // required for a reproducible run
       dt, maxCatchUp, iterations, maxSubsteps,
       sleepSpeed, sleepFrames, wakeSpeed,
       contactDamp,   // 0..1, velocity kept per step by a particle already
                      // touching two things. Bleeds numerical shiver out of a
                      // pile so it can actually reach the sleep threshold.
       sleepMinY,     // particles above this y are never allowed to sleep
       restCut,       // impacts slower than this are perfectly inelastic
       slop, correction,
       pegNudge, nudgeCone,   // seeded sideways flick on a near vertical
                              // static contact, so a ball cannot balance on a
                              // peg apex forever. cone is |nx| below which it
                              // fires. Set pegNudge to 0 to switch it off.
       onStep: function (stepIndex, world) {}   // runs before each fixed step
     });

     w.addParticle({x, y, vx, vy, r, m, data}) -> particle
     w.addPeg(x, y, r)                          -> peg
     w.addSegment(x1, y1, x2, y2, thickness)    -> segment
     w.step(dtSeconds)   accumulate real time, run capped fixed steps
     w.stepFixed()       exactly one fixed step
     w.stepN(n)          exactly n fixed steps (use this headless)
     w.settled()         true when nothing is awake
     w.awakeCount()
     w.reset()           drop all particles, rewind the step counter and the rng
     w.clearParticles()
     w.particles  w.pegs  w.segments  w.rand  w.dt  w.steps  w.bounds

   A particle carries an arbitrary `data` field, untouched by the solver, so a
   scene can colour and label it.
   ========================================================================== */
RTM.physics = (function () {
  "use strict";

  var DEFAULT_DT = 1 / 120;

  function def(v, d) { return (v === undefined || v === null) ? d : v; }

  function world(opts) {
    opts = opts || {};

    var gravity     = def(opts.gravity, 1400);
    var damping     = def(opts.damping, 0.6);        /* per second velocity decay */
    var restitution = def(opts.restitution, 0.2);
    var friction    = def(opts.friction, 0.25);
    var dt          = def(opts.dt, DEFAULT_DT);
    var maxCatchUp  = def(opts.maxCatchUp, 8);
    var iterations  = def(opts.iterations, 2);
    var sleepSpeed  = def(opts.sleepSpeed, 7);
    var sleepFrames = def(opts.sleepFrames, 28);
    var wakeSpeed   = def(opts.wakeSpeed, 14);
    var slop        = def(opts.slop, 0.06);
    var correction  = def(opts.correction, 0.85);
    var pegNudge    = def(opts.pegNudge, 0);
    var nudgeCone   = def(opts.nudgeCone, 0.22);
    var contactDamp = def(opts.contactDamp, 0.5);
    /* Particles above this y are never allowed to sleep. A scene that funnels
       everything through one entry point needs it: a ball that dozes off while
       queueing puts the whole queue to sleep behind it, settled() then reports
       true and the run finishes with half the balls stuck in mid air. Default
       is no restriction.                                                     */
    var sleepMinY   = def(opts.sleepMinY, -Infinity);

    /* One step of gravity is the natural unit for "is this contact resting or
       is it a real impact". Below two of those, restitution is switched off
       entirely, or a resting stack bounces on its own gravity every frame and
       never gets slow enough to sleep. Sleep and wake thresholds are floored
       against the same unit for the same reason.                            */
    var gStep = Math.abs(gravity) * dt;
    var restCut = def(opts.restCut, gStep * 2);
    if (sleepSpeed < gStep * 1.6) sleepSpeed = gStep * 1.6;
    if (wakeSpeed < sleepSpeed * 2) wakeSpeed = sleepSpeed * 2;
    var maxSub      = def(opts.maxSubsteps, 6);
    var seed        = def(opts.seed, 1);
    var onStep      = opts.onStep || null;

    var b = opts.bounds || {};
    var bounds = {
      x0: def(b.x0, 0), y0: def(b.y0, -1e6),
      x1: def(b.x1, 1000), y1: def(b.y1, 1000)
    };

    var particles = [];
    var pegs = [];
    var segments = [];

    var rand = RTM.rng(seed);
    var acc = 0;
    var stepCount = 0;
    var nextId = 0;

    var maxBallR = 1;
    var maxPegR = 1;
    var cellSize = 16;
    var cells = {};
    var pegCellSize = 24;
    var pegCells = null;

    /* ── spatial hash ───────────────────────────────────────────────────────
       Integer key with a large offset so negative cell indices stay distinct.
       Iteration order is by particle index and by a fixed 3x3 sweep, so the
       solve order never depends on object key ordering.                      */
    function keyOf(ix, iy) { return (ix + 2048) * 8192 + (iy + 2048); }

    function rebuildParticleGrid() {
      cellSize = Math.max(maxBallR * 2.05, 4);
      cells = {};
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var k = keyOf(Math.floor(p.x / cellSize), Math.floor(p.y / cellSize));
        if (cells[k]) cells[k].push(i); else cells[k] = [i];
      }
    }

    function rebuildPegGrid() {
      pegCellSize = Math.max((maxPegR + maxBallR) * 2.05, 6);
      pegCells = {};
      for (var i = 0; i < pegs.length; i++) {
        var g = pegs[i];
        var k = keyOf(Math.floor(g.x / pegCellSize), Math.floor(g.y / pegCellSize));
        if (pegCells[k]) pegCells[k].push(i); else pegCells[k] = [i];
      }
    }

    /* ── bodies ─────────────────────────────────────────────────────────── */
    function addParticle(p) {
      p = p || {};
      var r = def(p.r, 5);
      var m = def(p.m, r * r);
      var q = {
        id: nextId++,
        x: def(p.x, 0), y: def(p.y, 0),
        vx: def(p.vx, 0), vy: def(p.vy, 0),
        r: r, m: m, inv: m > 0 ? 1 / m : 0,
        sleeping: false, still: 0,
        contacts: 0,
        data: def(p.data, null)
      };
      particles.push(q);
      if (r > maxBallR) { maxBallR = r; pegCells = null; }
      return q;
    }

    function addPeg(x, y, r) {
      var g = { x: x, y: y, r: def(r, 6) };
      pegs.push(g);
      if (g.r > maxPegR) maxPegR = g.r;
      pegCells = null;
      return g;
    }

    function addSegment(x1, y1, x2, y2, thickness) {
      var s = { x1: x1, y1: y1, x2: x2, y2: y2, r: def(thickness, 0) };
      s.dx = x2 - x1; s.dy = y2 - y1;
      s.len2 = s.dx * s.dx + s.dy * s.dy;
      s.minX = Math.min(x1, x2); s.maxX = Math.max(x1, x2);
      s.minY = Math.min(y1, y2); s.maxY = Math.max(y1, y2);
      segments.push(s);
      return s;
    }

    function wake(p) { if (p.sleeping) { p.sleeping = false; p.still = 0; } }

    /* ── integration ────────────────────────────────────────────────────── */
    function integrate(hh) {
      var decay = 1 - damping * hh;
      if (decay < 0) decay = 0;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.sleeping || p.inv === 0) continue;
        p.vy += gravity * hh;
        p.vx *= decay; p.vy *= decay;
        p.x += p.vx * hh;
        p.y += p.vy * hh;
      }
    }

    /* ── contact solvers ────────────────────────────────────────────────────
       All three share the same shape: find the normal, push the bodies apart
       past a slop band, then apply a normal impulse with restitution and a
       clamped tangential impulse for friction.                              */

    function solveStatic(p, cx, cy, sr) {
      var dx = p.x - cx, dy = p.y - cy;
      var R = p.r + sr;
      var d2 = dx * dx + dy * dy;
      if (d2 >= R * R) return;

      var d = Math.sqrt(d2), nx, ny;
      if (d > 1e-9) { nx = dx / d; ny = dy / d; }
      else { nx = 0; ny = -1; d = 0; }

      var pen = R - d;
      var push = (pen - slop) * correction;
      if (push > 0) { p.x += nx * push; p.y += ny * push; }

      var vn = p.vx * nx + p.vy * ny;
      if (vn < 0) {
        var jn = -(1 + (-vn < restCut ? 0 : restitution)) * vn;
        p.vx += jn * nx; p.vy += jn * ny;

        var tx = -ny, ty = nx;
        var vt = p.vx * tx + p.vy * ty;
        var jt = -vt * friction;
        var cap = Math.abs(jn) * friction;
        if (jt > cap) jt = cap; else if (jt < -cap) jt = -cap;
        p.vx += jt * tx; p.vy += jt * ty;
      }

      /* Balanced on the apex. In two dimensions a disc resting exactly on top
         of another disc is a real equilibrium, so without help the ball simply
         goes to sleep on the peg and never picks a side. A seeded sideways
         flick breaks the symmetry, which is what the third dimension and a
         slightly imperfect peg do on a physical board.

         The cone is narrow and the normal must point upward, so this only ever
         fires on a peg apex: never on a wall, never on the floor (bounds are
         solved separately) and never inside the pile, where contacts between
         stacked balls are spread across every angle. That matters, because a
         nudge that reached the pile would keep it awake forever.             */
      if (pegNudge && Math.abs(nx) < nudgeCone && ny < -0.86) {
        p.vx += (rand() - 0.5) * 2 * pegNudge;
        p.still = 0;
      }

      /* Wake on impact speed, not on penetration. A soft constraint solver
         always leaves some overlap at the bottom of a loaded stack, and a
         penetration test reads that as a collision every single step, so the
         bottom row of the tallest bin never sleeps. Only a genuine overlap,
         most of a radius deep, is treated as an emergency.                   */
      if (vn < -wakeSpeed || pen > p.r * 0.9) wake(p);
      p.contacts++;
    }

    function solvePair(a, bq) {
      var dx = bq.x - a.x, dy = bq.y - a.y;
      var R = a.r + bq.r;
      var d2 = dx * dx + dy * dy;
      if (d2 >= R * R) return;

      var d = Math.sqrt(d2), nx, ny;
      if (d > 1e-9) { nx = dx / d; ny = dy / d; }
      else {
        /* Perfectly coincident. Separate along a seeded direction. */
        var ang = rand() * Math.PI * 2;
        nx = Math.cos(ang); ny = Math.sin(ang); d = 0;
      }

      var invSum = a.inv + bq.inv;
      if (invSum === 0) return;

      var pen = R - d;
      var push = (pen - slop) * correction / invSum;
      if (push > 0) {
        a.x -= nx * push * a.inv; a.y -= ny * push * a.inv;
        bq.x += nx * push * bq.inv; bq.y += ny * push * bq.inv;
      }

      var rvx = bq.vx - a.vx, rvy = bq.vy - a.vy;
      var vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        var jn = -(1 + (-vn < restCut ? 0 : restitution)) * vn / invSum;
        a.vx -= jn * nx * a.inv; a.vy -= jn * ny * a.inv;
        bq.vx += jn * nx * bq.inv; bq.vy += jn * ny * bq.inv;

        var tx = -ny, ty = nx;
        rvx = bq.vx - a.vx; rvy = bq.vy - a.vy;
        var vt = rvx * tx + rvy * ty;
        var jt = -vt / invSum * friction;
        var cap = Math.abs(jn) * friction;
        if (jt > cap) jt = cap; else if (jt < -cap) jt = -cap;
        a.vx -= jt * tx * a.inv; a.vy -= jt * ty * a.inv;
        bq.vx += jt * tx * bq.inv; bq.vy += jt * ty * bq.inv;
      }

      if (vn < -wakeSpeed || pen > Math.min(a.r, bq.r) * 0.9) { wake(a); wake(bq); }
      a.contacts++; bq.contacts++;
    }

    function solveSegment(p, s) {
      if (p.x + p.r < s.minX - s.r || p.x - p.r > s.maxX + s.r) return;
      if (p.y + p.r < s.minY - s.r || p.y - p.r > s.maxY + s.r) return;
      var t = 0;
      if (s.len2 > 0) {
        t = ((p.x - s.x1) * s.dx + (p.y - s.y1) * s.dy) / s.len2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
      }
      solveStatic(p, s.x1 + t * s.dx, s.y1 + t * s.dy, s.r);
    }

    function solveBounds(p) {
      if (p.inv === 0) return;
      var hit = false;
      if (p.x - p.r < bounds.x0) {
        p.x = bounds.x0 + p.r;
        if (p.vx < 0) { p.vx = -p.vx * restitution; p.vy *= (1 - friction); }
        hit = true;
      } else if (p.x + p.r > bounds.x1) {
        p.x = bounds.x1 - p.r;
        if (p.vx > 0) { p.vx = -p.vx * restitution; p.vy *= (1 - friction); }
        hit = true;
      }
      if (p.y + p.r > bounds.y1) {
        p.y = bounds.y1 - p.r;
        if (p.vy > 0) {
          if (p.vy < wakeSpeed) p.vy = 0; else p.vy = -p.vy * restitution;
          p.vx *= (1 - friction);
        }
        hit = true;
      } else if (p.y - p.r < bounds.y0) {
        p.y = bounds.y0 + p.r;
        if (p.vy < 0) p.vy = -p.vy * restitution;
        hit = true;
      }
      if (hit) p.contacts++;
    }

    /* ── one collision pass over everything ─────────────────────────────── */
    function collide() {
      if (!pegCells) rebuildPegGrid();
      rebuildParticleGrid();

      for (var it = 0; it < iterations; it++) {
        /* particle vs particle, each pair once */
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var ix = Math.floor(p.x / cellSize), iy = Math.floor(p.y / cellSize);
          for (var gx = -1; gx <= 1; gx++) {
            for (var gy = -1; gy <= 1; gy++) {
              var list = cells[keyOf(ix + gx, iy + gy)];
              if (!list) continue;
              for (var n = 0; n < list.length; n++) {
                var j = list[n];
                if (j <= i) continue;
                var o = particles[j];
                if (p.sleeping && o.sleeping) continue;
                solvePair(p, o);
              }
            }
          }
        }

        /* particle vs static geometry */
        for (var k = 0; k < particles.length; k++) {
          var q = particles[k];
          if (q.sleeping) continue;
          var px = Math.floor(q.x / pegCellSize), py = Math.floor(q.y / pegCellSize);
          for (var ax = -1; ax <= 1; ax++) {
            for (var ay = -1; ay <= 1; ay++) {
              var pl = pegCells[keyOf(px + ax, py + ay)];
              if (!pl) continue;
              for (var m = 0; m < pl.length; m++) {
                var g = pegs[pl[m]];
                solveStatic(q, g.x, g.y, g.r);
              }
            }
          }
          for (var s = 0; s < segments.length; s++) solveSegment(q, segments[s]);
          solveBounds(q);
        }
      }
    }

    function updateSleep() {
      var lim = sleepSpeed * sleepSpeed;
      var soft = (sleepSpeed * 3) * (sleepSpeed * 3);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.sleeping || p.inv === 0) continue;
        var s2 = p.vx * p.vx + p.vy * p.vy;
        /* Granular damping. A ball already touching two things is in a pile,
           not in flight, and the small residual velocity left by positional
           correction is numerical noise rather than motion. Bleed it off hard
           or the pile shivers forever and nothing ever reaches the sleep
           threshold. Flight is untouched: one contact or none is not a pile. */
        if (p.y < sleepMinY) { p.still = 0; continue; }
        if (p.contacts >= 2 && s2 < soft) {
          p.vx *= contactDamp; p.vy *= contactDamp;
          s2 = p.vx * p.vx + p.vy * p.vy;
        }
        if (s2 < lim) {
          p.still++;
          if (p.still >= sleepFrames) { p.sleeping = true; p.vx = 0; p.vy = 0; }
        } else p.still = 0;
      }
    }

    /* ── stepping ───────────────────────────────────────────────────────────
       Substeps inside the fixed step keep fast balls from passing through a
       peg. The count is derived from the current maximum speed, so it is a
       pure function of state and does not break determinism.                */
    function stepFixed() {
      if (onStep) onStep(stepCount, W);

      var maxV2 = 0, minR = Infinity;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.r < minR) minR = p.r;
        if (p.sleeping) continue;
        var s2 = p.vx * p.vx + p.vy * p.vy;
        if (s2 > maxV2) maxV2 = s2;
        p.contacts = 0;
      }
      if (!isFinite(minR)) minR = 4;

      var travel = Math.sqrt(maxV2) * dt;
      var sub = Math.ceil(travel / Math.max(minR * 0.5, 0.5));
      if (sub < 1) sub = 1; else if (sub > maxSub) sub = maxSub;

      var hh = dt / sub;
      for (var s = 0; s < sub; s++) { integrate(hh); collide(); }
      updateSleep();
      stepCount++;
    }

    function stepN(n) { for (var i = 0; i < n; i++) stepFixed(); }

    function step(dtSeconds) {
      acc += Math.min(dtSeconds || 0, 0.5);
      var n = 0;
      while (acc >= dt && n < maxCatchUp) { stepFixed(); acc -= dt; n++; }
      if (n >= maxCatchUp) acc = 0;   /* drop the backlog rather than spiral */
      return n;
    }

    function awakeCount() {
      var c = 0;
      for (var i = 0; i < particles.length; i++) if (!particles[i].sleeping) c++;
      return c;
    }
    function settled() { return particles.length > 0 && awakeCount() === 0; }

    function clearParticles() { particles.length = 0; cells = {}; }

    function reset() {
      clearParticles();
      acc = 0; stepCount = 0; nextId = 0;
      rand = RTM.rng(seed);
      W.rand = rand;
    }

    var W = {
      particles: particles, pegs: pegs, segments: segments,
      bounds: bounds, dt: dt, rand: rand,
      addParticle: addParticle, addPeg: addPeg, addSegment: addSegment,
      step: step, stepFixed: stepFixed, stepN: stepN,
      settled: settled, awakeCount: awakeCount,
      reset: reset, clearParticles: clearParticles,
      wake: wake
    };
    Object.defineProperty(W, "steps", { get: function () { return stepCount; } });
    return W;
  }

  return { world: world, DT: DEFAULT_DT };
})();
