(() => {
	// plugins
	Matter.use(MatterAttractors);

	// constants
	const PATHS = {
		DOME: 'M 0 0 L 0 261 L 15 261 L 17 235 L 19 207 L 26 179 L 36 151 L 52 123 L 71 97 L 99 68 L 126 48 L 154 33 L 182 23 L 210 16 L 238 13 L 265 13 L 293 16 L 321 23 L 349 33 L 376 48 L 404 68 L 432 97 L 451 123 L 466 151 L 477 179 L 484 207 L 486 235 L 486 261 L 500 261 L 500 0 L 0 0',
		DROP_LEFT: '0 0 20 0 70 100 20 150 0 150 0 0',
		DROP_RIGHT: '50 0 68 0 68 150 50 150 0 100 50 0',
		APRON_LEFT: '0 0 L 0 191 L 210 192 L 210 121',
		APRON_RIGHT: '210 0 L 0 121 L 0 191 L 210 191',
		FLIPPER_EDGE_RIGHT : '125 0 L 126 260 L 45 190 L 0 70',
		FLIPPER_EDGE_LEFT : '0 0 L 0 260 L 80 190 L 125 70'
	};
	const COLOR = {
		BACKGROUND: '#212529',
		OUTER: '#495057',
		INNER: '#15aabf',
		BUMPER: '#fab005',
		BUMPER_LIT: '#fff3bf',
		BUMPER_FLASH : '#dee2e6',
		TARGET: '#fab005',
		TARGET_LIT: '#dee2e6',
		PADDLE: '#e64980',
		PINBALL: '#dee2e6'
	};
	const GRAVITY = 0.75;
	const WIREFRAMES = false;
	const BUMPER_BOUNCE = 1.5;
	const PADDLE_PULL = 0.002;
	const MAX_VELOCITY = 50;

	// score elements
	let $currentScore = $('.current-score span');
	let $currentBonus = $('.current-bonus span');
	let $highScore = $('.high-score span');

	// shared variables
	let currentScore, highScore;
	let currentBonus = 0;
	let engine, world, render, pinball, stopperGroup;
	let leftPaddle, leftUpStopper, leftDownStopper, isLeftPaddleUp;
	let rightPaddle, rightUpStopper, rightDownStopper, isRightPaddleUp;

	let targets = [];
	let bumpers = [];
	let holes = [];
	function load() {
		init();
		createStaticBodies();
		createPaddles();
		createPinball();
		createEvents();
	}

	function init() {
		// engine (shared)
		engine = Matter.Engine.create();

		// world (shared)
		world = engine.world;
		world.bounds = {
			min: { x: 0, y: 0},
			max: { x: 500, y: 694 }
		};
		world.gravity.y = GRAVITY; // simulate rolling on a slanted table

		// render (shared)
		render = Matter.Render.create({
			element: $('.container')[0],
			engine: engine,
			options: {
				width: world.bounds.max.x,
				height: world.bounds.max.y,
				wireframes: WIREFRAMES,
				background: COLOR.BACKGROUND
			}
		});
		Matter.Render.run(render);

		// runner
		let runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		// used for collision filtering on various bodies
		stopperGroup = Matter.Body.nextGroup(true);

		// starting values
		currentScore = 0;
		currentBonus = 0;
		highScore = 0;
		isLeftPaddleUp = false;
		isRightPaddleUp = false;
	}

	function createStaticBodies() {

		bumpers = [
			bumper(134, 281, 25, 20, 10),
			bumper(207, 169, 25, 40, 20),
			bumper(315, 235, 25, 80, 10)
		];

		targets = [
			target(120, 110, 5),
			target(145, 95, 5),
			target(180, 80, 5),
			target(210, 75, 5),
			target(250, 70, 5),
			target(270, 70, 5),
			target(290, 70, 5),
			target(310, 70, 5)
		];

		holes = [
			hole(100, 450, 150)
		]

		Matter.World.add(world, bumpers);
		Matter.World.add(world, targets);
		// Matter.World.add(world, holes);
		Matter.World.add(world, [
			// table boundaries (top, bottom, left, right)
			boundary(500/2, 7, 500, 14),
			boundary(500/2, 694-7, 500, 14),
			boundary(7, 694/2, 14, 694),
			boundary(500-7, 694/2, 14, 694),

			// dome
			path(250, 76, PATHS.DOME),

			// shooter lane wall
			wall(445, 476, 15, 435, COLOR.OUTER),

			// slingshots (left, right)
			wall(56, 360, 15, 60, COLOR.INNER),
			wall(395, 360, 15, 60, COLOR.INNER),

			// aprons (left, right)
			path(90, 622, PATHS.APRON_LEFT),
			path(361, 622, PATHS.APRON_RIGHT),

			path(55, 600, PATHS.FLIPPER_EDGE_LEFT),
			path(395, 600, PATHS.FLIPPER_EDGE_RIGHT),

			// reset zones (center, right)
			reset(226, 30),
			reset(470, 33)
		]);
	}

	function createPaddles() {
		let hingeY = 565;
		let leftHingeX = 140;
		let rightHingeX = 310;
		let flipperOffsetX = 30;

		// these bodies keep paddle swings contained, but allow the ball to pass through
		leftUpStopper = stopper(leftHingeX + flipperOffsetX, 480, 'left', 'up');
		leftDownStopper = stopper(leftHingeX + flipperOffsetX, 635, 'left', 'down');
		rightUpStopper = stopper(rightHingeX - flipperOffsetX, 480, 'right', 'up');
		rightDownStopper = stopper(rightHingeX - flipperOffsetX, 635, 'right', 'down');
		Matter.World.add(world, [leftUpStopper, leftDownStopper, rightUpStopper, rightDownStopper]);

		// this group lets paddle pieces overlap each other
		let paddleGroup = Matter.Body.nextGroup(true);

		// Left paddle mechanism
		let paddleLeft = {};
		paddleLeft.paddle = Matter.Bodies.trapezoid(leftHingeX + flipperOffsetX, hingeY, 20, 80, 0.33, {
			label: 'paddleLeft',
			angle: 1.67,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleLeft.brick = Matter.Bodies.rectangle(leftHingeX + flipperOffsetX, hingeY, 20, 80, {
			angle: 1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleLeft.comp = Matter.Body.create({
			label: 'paddleLeftComp',
			parts: [paddleLeft.paddle, paddleLeft.brick]
		});
		paddleLeft.hinge = Matter.Bodies.circle(leftHingeX, hingeY, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleLeft).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleLeft.con = Matter.Constraint.create({
			bodyA: paddleLeft.comp,
			pointA: { x: -flipperOffsetX, y: -3 },
			bodyB: paddleLeft.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleLeft.comp, paddleLeft.hinge, paddleLeft.con]);
		Matter.Body.rotate(paddleLeft.comp, 0.57, { x: leftHingeX, y: hingeY });

		// right paddle mechanism
		let paddleRight = {};
		paddleRight.paddle = Matter.Bodies.trapezoid(rightHingeX - flipperOffsetX, hingeY, 20, 80, 0.33, {
			label: 'paddleRight',
			angle: -1.67,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleRight.brick = Matter.Bodies.rectangle(rightHingeX - flipperOffsetX, hingeY, 20, 80, {
			angle: -1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleRight.comp = Matter.Body.create({
			label: 'paddleRightComp',
			parts: [paddleRight.paddle, paddleRight.brick]
		});
		paddleRight.hinge = Matter.Bodies.circle(rightHingeX, hingeY, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleRight).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleRight.con = Matter.Constraint.create({
			bodyA: paddleRight.comp,
			pointA: { x: flipperOffsetX, y: -3 },
			bodyB: paddleRight.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleRight.comp, paddleRight.hinge, paddleRight.con]);
		Matter.Body.rotate(paddleRight.comp, -0.57, { x: rightHingeX, y: hingeY });
	}

	function createPinball() {
		// x/y are set to when pinball is launched
		pinball = Matter.Bodies.circle(0, 0, 14, {
			label: 'pinball',
			collisionFilter: {
				group: stopperGroup
			},
			render: {
				fillStyle: COLOR.PINBALL
			}
		});
		Matter.World.add(world, pinball);
		launchPinball();
	}

	function createEvents() {
		// events for when the pinball hits stuff
		Matter.Events.on(engine, 'collisionStart', function(event) {
			let pairs = event.pairs;
			pairs.forEach(function(pair) {
				if (pair.bodyB.label === 'pinball') {
					switch (pair.bodyA.label) {
						case 'reset':
							launchPinball();
							break;
						case 'bumper':
							pingBumper(pair.bodyA);
							break;
						case 'target':
							pingTarget(pair.bodyA);
							break;
						case 'hole':
							break
					}
				}
			});
		});

		// regulate pinball
		Matter.Events.on(engine, 'beforeUpdate', function(event) {
			// bumpers can quickly multiply velocity, so keep that in check
			Matter.Body.setVelocity(pinball, {
				x: Math.max(Math.min(pinball.velocity.x, MAX_VELOCITY), -MAX_VELOCITY),
				y: Math.max(Math.min(pinball.velocity.y, MAX_VELOCITY), -MAX_VELOCITY),
			});

			// cheap way to keep ball from going back down the shooter lane
			if (pinball.position.x > 450 && pinball.velocity.y > 0) {
				Matter.Body.setVelocity(pinball, { x: 0, y: -10 });
			}
		});

		// mouse drag (god mode for grabbing pinball)
		Matter.World.add(world, Matter.MouseConstraint.create(engine, {
			mouse: Matter.Mouse.create(render.canvas),
			constraint: {
				stiffness: 0.2,
				render: {
					visible: false
				}
			}
		}));

		// keyboard paddle events
		$('body').on('keydown', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = true;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = true;
			}
		});
		$('body').on('keyup', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = false;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = false;
			}
		});

		// click/tap paddle events
		$('.left-trigger')
			.on('mousedown touchstart', function(e) {
				isLeftPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isLeftPaddleUp = false;
			});
		$('.right-trigger')
			.on('mousedown touchstart', function(e) {
				isRightPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isRightPaddleUp = false;
			});
		$('.reset')
			.on('mouseup touchend', function(e) {
				launchPinball();
			});
	}

	function launchPinball() {
		setFinalScore();
		updateScore(0);
		updateBonus(0);
		setTargetsInactive();
		Matter.Body.setPosition(pinball, { x: 470, y: 678 });
		Matter.Body.setVelocity(pinball, { x: 0, y: -25 + rand(-2, 2) });
		Matter.Body.setAngularVelocity(pinball, 0);
	}

	function isBumperActive(bumper) {
		return bumper.min_bonus <= currentBonus;
	}

	function pingBumper(bumper) {

		let incPoints;
		if (isBumperActive(bumper)) {
			incPoints = bumper.active_points;
		} else {
			incPoints = bumper.inactive_points;
		}

		updateScore(currentScore + incPoints);

		// flash color
		bumper.render.fillStyle = COLOR.BUMPER_FLASH;
		setTimeout(function() {
			refreshBumperColor(bumper)
		}, 100);
	}

	function refreshBumperColors() {
		for (let i = 0; i < bumpers.length; i++) {
			refreshBumperColor(bumpers[i]);
		}
	}

	function refreshBumperColor(bumper) {
		if (isBumperActive(bumper)) {
			bumper.render.fillStyle = COLOR.BUMPER_LIT;
		} else {
			bumper.render.fillStyle = COLOR.BUMPER;
		}
	}

	function areAllTargetsActive() {
		for (let i = 0; i < targets.length; i++) {
			if (!targets[i].is_active) {
				return false;
			}
		}
		return true;
	}

	function isTargetActive(target) {
		return target.is_active;
	}

	function setTargetsInactive() {
		for (let i = 0; i < targets.length; i++) {
			targets[i].is_active = false;
			refreshTargetColor(targets[i]);
		}
	}

	function pingTarget(target) {
		let incPoints;
		let incBonus;
		if (isTargetActive(target)) {
			incPoints = target.active_points;
			incBonus = target.active_bonus;
		} else {
			incPoints = target.inactive_points;
			incBonus = target.inactive_bonus;
		}

		target.is_active = true;

		if (areAllTargetsActive()) {
			setTargetsInactive();
		}

		updateScore(currentScore + incPoints);
		updateBonus(currentBonus + incBonus);
		refreshTargetColor(target);
	}

	function refreshTargetColor(target) {
		if (target.is_active) {
			target.render.fillStyle = COLOR.TARGET;
		} else {
			target.render.fillStyle = COLOR.TARGET_LIT;
		}
	}

	function updateScore(newCurrentScore) {
		currentScore = newCurrentScore;
		$currentScore.text(currentScore);

		highScore = Math.max(currentScore, highScore);
		$highScore.text(highScore);
	}

	function setFinalScore() {
		updateScore(currentScore + currentBonus);
	}

	function updateBonus(newCurrentBonus) {
		currentBonus = Math.min(Math.max(0, newCurrentBonus), 100);
		$currentBonus.text(currentBonus);
		refreshBumperColors();
	}

	// matter.js has a built in random range function, but it is deterministic
	function rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	// outer edges of pinball table
	function boundary(x, y, width, height) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER
			}
		});
	}

	function trainCar(x, y, width, height, angle) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			isStatic: true,
			angle: angle,
			render: {
				visible: true
			}
		});
	}

	// wall segments
	function wall(x, y, width, height, color, angle = 0) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			angle: angle,
			isStatic: true,
			chamfer: { radius: 10 },
			render: {
				fillStyle: color
			}
		});
	}

	// bodies created from SVG paths
	function path(x, y, path) {
		let vertices = Matter.Vertices.fromPath(path);
		return Matter.Bodies.fromVertices(x, y, vertices, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER,

				// add stroke and line width to fill in slight gaps between fragments
				strokeStyle: COLOR.OUTER,
				lineWidth: 1
			}
		});
	}

	function bumper(x, y, radius, minBonus, activePoints) {
		let bumper = Matter.Bodies.circle(x, y, radius, {
			label: 'bumper',
			min_bonus: minBonus,
			inactive_points: 1,
			active_points: activePoints,
			isStatic: true
		});
		bumper.restitution = BUMPER_BOUNCE;
		return bumper;
	}

	function target(x, y, radius) {
		let target = Matter.Bodies.circle(x, y, radius, {
			label: 'target',
			isStatic: true,
			is_active: false,
			inactive_points: 20,
			active_points: 0,
			inactive_bonus : 10,
			active_bonus : 0
		});
		target.restitution = BUMPER_BOUNCE;
		return target;
	}


	function hole(x, y, radius) {
		let hole = Matter.Bodies.circle(x, y, radius, {
			label: 'hole',
			isStatic: true,
			render: {
				fillStyle: '#fff'
			}
		});

		return hole;
	}

	// invisible bodies to constrict paddles
	function stopper(x, y, side, position) {
		// determine which paddle composite to interact with
		let attracteeLabel = (side === 'left') ? 'paddleLeftComp' : 'paddleRightComp';

		return Matter.Bodies.circle(x, y, 40, {
			isStatic: true,
			render: {
				visible: false,
			},
			collisionFilter: {
				group: stopperGroup
			},
			plugin: {
				attractors: [
					// stopper is always a, other body is b
					function(a, b) {
						if (b.label === attracteeLabel) {
							let isPaddleUp = (side === 'left') ? isLeftPaddleUp : isRightPaddleUp;
							let isPullingUp = (position === 'up' && isPaddleUp);
							let isPullingDown = (position === 'down' && !isPaddleUp);
							if (isPullingUp || isPullingDown) {
								return {
									x: (a.position.x - b.position.x) * PADDLE_PULL,
									y: (a.position.y - b.position.y) * PADDLE_PULL,
								};
							}
						}
					}
				]
			}
		});
	}

	// contact with these bodies causes pinball to be relaunched
	function reset(x, width) {
		return Matter.Bodies.rectangle(x, 678, width, 2, {
			label: 'reset',
			isStatic: true,
			render: {
				fillStyle: '#fff'
			}
		});
	}

	window.addEventListener('load', load, false);
})();