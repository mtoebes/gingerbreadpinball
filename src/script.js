(() => {
	// plugins
	Matter.use(MatterAttractors);

	// constants
	const PATHS = {
		DOME: 'M 0 0 L 0 261 L 15 261 L 17 235 L 19 207 L 26 179 L 36 151 L 52 123 L 71 97 L 99 68 L 126 48 L 154 33 L 182 23 L 210 16 L 238 13 L 265 13 L 293 16 L 321 23 L 349 33 L 376 48 L 404 68 L 432 97 L 451 123 L 466 151 L 477 179 L 484 207 L 486 235 L 486 261 L 500 261 L 500 0 L 0 0',
		DROP_LEFT: '0 0 20 0 70 100 20 150 0 150 0 0',
		DROP_RIGHT: '50 0 68 0 68 150 50 150 0 100 50 0',
		APRON_LEFT: '0 0 L 0 127 L 196 127 L 196 113 L 0 0',
		APRON_RIGHT: '0 0 L 0 127 L -196 127 L -196 113 L 0 0',
		FLIPPER_EDGE_LEFT: '0 0 L 0 270 L 60 180 L 120 68',
		FLIPPER_EDGE_RIGHT: '120 0 L 120 260 L 60 180 L 0 68',
	};
	const COLOR = {
		OUTER: '#996c4bff',
		INNER: '#996c4bff',
		BUMPER: '#00000000',
		BUMPER_LIT: '#FFE63280',
		BUMPER_FLASH: '#ffffff50',
		TARGET_INACTIVE: '#00000000',
		TARGET_ACTIVE: '#212529ff',
		PADDLE: '#e64980ff',
		HOLE: '#67c330ff',
		PINBALL: '#989897ff',
		TRAIN : '#165ea0ff',
		ELF_BUMPER : '#165ea0ff'
	};
	const GRAVITY = 0.75;
	const WIREFRAMES = false;
	const BUMPER_BOUNCE = 1.5;
	const ELF_BUMPER_BOUNCE = .75;
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
			min: { x: 0, y: 0 },
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
				background: 'transparent'
			},
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
			bumper(126, 255, 25, 20, 10),
			bumper(213, 173, 25, 40, 20),
			bumper(315, 255, 25, 80, 10)
		];

		targets = [
			target(65, 166, -90 * Math.PI / 180),
			target(84, 106, -32 * Math.PI / 180),
			target(132, 64, -32 * Math.PI / 180),
			target(180, 42, -10 * Math.PI / 180),
			target(240, 37, -10 * Math.PI / 180),
			target(304, 37, 20 * Math.PI / 180),
			target(351, 57, 20 * Math.PI / 180),
		];

		holes = [
			hole(152, 394, 5),
			hole(291, 394, 5),
			// hole(425, 125, 15)
		];

		let trainWidth = 140;
		let trains = [
			trainCar(25, 140-30, trainWidth, 60, -90 * Math.PI / 180),
			trainCar(97, 35, trainWidth, 60, -32 * Math.PI / 180),
			trainCar(207, 0, trainWidth, 60, -10 * Math.PI / 180),
			trainCar(335-20, 5, trainWidth, 60, 20 * Math.PI / 180),
		];
		Matter.World.add(world, bumpers);
		Matter.World.add(world, targets);
		Matter.World.add(world, holes);
		// Matter.World.add(world, trains);
		Matter.World.add(world, [

			// elf
			// elfBumper(360, 70, 20),

			// table boundaries (top, bottom, left, right)

			boundary(500 / 2, 7, 500, 14),
			boundary(500 / 2, 694 - 7, 500, 14),
			boundary(7, 694 / 2, 14, 694),
			boundary(500 - 7, 694 / 2, 14, 694),

			// dome
			path(250, 76, PATHS.DOME),

			// shooter lane wall
			wall(448, 488, 15, 435, COLOR.OUTER),

			// slingshots (left, right)
			wall(56, 384, 15, 62, COLOR.INNER),
			wall(400, 384, 15, 62, COLOR.INNER),

			// aprons (left, right)
			path(86, 607, PATHS.APRON_LEFT),
			path(372, 607, PATHS.APRON_RIGHT),

			path(50, 600, PATHS.FLIPPER_EDGE_LEFT),
			path(410, 600, PATHS.FLIPPER_EDGE_RIGHT),

			// reset zones (center, right)
			reset(226, 30),
			reset(470, 33)
		]);
	}

	function createPaddles() {
		let hingeY = 570;
		let leftHingeX = 130;
		let rightHingeX = 330;
		let flipperOffsetX = 40;
		let flipperLength = 100;
		let flipperWidth = 25;

		// these bodies keep paddle swings contained, but allow the ball to pass through
		leftUpStopper = stopper(leftHingeX + flipperOffsetX-20, 470, 'left', 'up');
		leftDownStopper = stopper(leftHingeX + flipperOffsetX, 650, 'left', 'down');
		rightUpStopper = stopper(rightHingeX - flipperOffsetX+20, 470, 'right', 'up');
		rightDownStopper = stopper(rightHingeX - flipperOffsetX, 650, 'right', 'down');
		Matter.World.add(world, [leftUpStopper, leftDownStopper, rightUpStopper, rightDownStopper]);

		// this group lets paddle pieces overlap each other
		let paddleGroup = Matter.Body.nextGroup(true);

		// Left paddle mechanism
		let paddleLeft = {};
		paddleLeft.paddle = Matter.Bodies.trapezoid(leftHingeX + flipperOffsetX, hingeY, flipperWidth, flipperLength, 0.33, {
			label: 'paddleLeft',
			angle: 1.67,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleLeft.brick = Matter.Bodies.rectangle(leftHingeX + flipperOffsetX, hingeY, flipperWidth, flipperLength, {
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
		paddleRight.paddle = Matter.Bodies.trapezoid(rightHingeX - flipperOffsetX, hingeY, flipperWidth, flipperLength, 0.33, {
			label: 'paddleRight',
			angle: -1.67,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleRight.brick = Matter.Bodies.rectangle(rightHingeX - flipperOffsetX, hingeY, flipperWidth, flipperLength, {
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
		Matter.Events.on(engine, 'collisionStart', function (event) {
			let pairs = event.pairs;
			pairs.forEach(function (pair) {
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
							pingHole(pair.bodyA);
							break;
					}
				}
			});
		});

		Matter.Events.on(engine, 'collisionEnd', function (event) {
			let pairs = event.pairs;
			pairs.forEach(function (pair) {
				if (pair.bodyB.label === 'pinball' && pair.bodyA.label === 'hole') {
					let pinball = pair.bodyB;
					let hole = pair.bodyA;
					hole.collisionFilter.group = stopperGroup;
					Matter.Body.setVelocity(pinball, { x: 0, y: 0 });
					Matter.Body.setPosition(pinball, { x: hole.position.x, y: hole.position.y });
					world.gravity.y = 0;
					setTimeout(function () {
						let kick_degrees = rand(hole.min_kick_degrees, hole.max_kick_degrees);
						let kick_radians = kick_degrees * Math.PI / 180;
						let xVelocity = hole.kick_velocity * Math.cos(kick_radians);
						let yVelocity = hole.kick_velocity * Math.sin(kick_radians);
						Matter.Body.setVelocity(pinball, { x: xVelocity, y: yVelocity });
						world.gravity.y = GRAVITY;
						setTimeout(function () {
							hole.collisionFilter.group = undefined;
						}, 100);
					}, hole.hold_ms);
				}
			});
		});

		// regulate pinball
		Matter.Events.on(engine, 'beforeUpdate', function (event) {
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
		$('body').on('keydown', function (e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = true;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = true;
			}
		});
		$('body').on('keyup', function (e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = false;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = false;
			}
		});

		// click/tap paddle events
		$('.left-trigger')
			.on('mousedown touchstart', function (e) {
				isLeftPaddleUp = true;
			})
			.on('mouseup touchend', function (e) {
				isLeftPaddleUp = false;
			});
		$('.right-trigger')
			.on('mousedown touchstart', function (e) {
				isRightPaddleUp = true;
			})
			.on('mouseup touchend', function (e) {
				isRightPaddleUp = false;
			});
		$('.reset')
			.on('mouseup touchend', function (e) {
				launchPinball();
			});
	}

	function launchPinball() {
		setFinalScore();
		updateScore(0);
		updateBonus(0);
		setTargetsInactive();
		Matter.Body.setPosition(pinball, { x: 470, y: 678 });
		Matter.Body.setVelocity(pinball, { x: 0, y: -35 + rand(-2, 2) });
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
		setTimeout(function () {
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
			targets[i].collisionFilter.group = undefined;
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
		target.collisionFilter.group = stopperGroup;

		if (areAllTargetsActive()) {
			setTargetsInactive();
		}

		updateScore(currentScore + incPoints);
		updateBonus(currentBonus + incBonus);
		refreshTargetColor(target);
	}

	function refreshTargetColor(target) {
		if (target.is_active) {
			target.render.fillStyle = COLOR.TARGET_INACTIVE;
		} else {
			target.render.fillStyle = COLOR.TARGET_ACTIVE;
		}
	}

	function pingHole(hole) {
		let incBonus = hole.bonus;
		updateBonus(currentBonus + incBonus);
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
				visible: true,
				fillStyle: COLOR.TRAIN
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


	function elfBumper(x, y, radius) {
		let bumper = Matter.Bodies.circle(x, y, radius, {
			label: 'elfbumper',
			isStatic: true,
			render: {
				fillStyle: COLOR.ELF_BUMPER
			}

		});
		bumper.restitution = ELF_BUMPER_BOUNCE;
		return bumper;
	}

	function target(x, y, angle) {
		let target = Matter.Bodies.rectangle(x, y, 30, 20, {
			label: 'target',
			angle: angle,
			chamfer: { radius: 5 },
			isStatic: true,
			is_active: false,
			inactive_points: 20,
			active_points: 0,
			inactive_bonus: 10,
			active_bonus: 0
		});
		target.restitution = BUMPER_BOUNCE;
		return target;
	}

	function roundTarget(x, y, radius) {
		let target = Matter.Bodies.circle(x, y, radius, {
			label: 'target',
			isStatic: true,
			is_active: false,
			inactive_points: 20,
			active_points: 0,
			inactive_bonus: 10,
			active_bonus: 0
		});
		target.restitution = BUMPER_BOUNCE;
		return target;
	}


	function hole(x, y, radius) {
		let hole = Matter.Bodies.circle(x, y, radius, {
			label: 'hole',
			isStatic: true,
			bonus: -20,
			min_kick_degrees: 90 - 60,
			max_kick_degrees: 90 + 60,
			kick_velocity: 15,
			hold_ms: 500,
			render: {
				fillStyle: COLOR.HOLE
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
					function (a, b) {
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

	function scaleContainer() {
		const container = document.querySelector('.container');
		const nominalWidth = 500; // Nominal canvas width
		const nominalHeight = 694; // Nominal canvas height

		// Get the available window dimensions
		const sizer = document.querySelector('.sizer');
		const sizerRect = sizer.getBoundingClientRect();

		const windowWidth = sizerRect.width;
		const windowHeight = sizerRect.height;

		// Calculate the scale factor
		const scale = Math.min(windowWidth / nominalWidth, windowHeight / nominalHeight);
		console.log('Scale=' + scale + ' ' + windowWidth + '/' + nominalWidth + ' ' + windowHeight + '/' + nominalHeight)

		// Apply the scale transformation
		container.style.transform = `scale(${scale})`;

		// Center the container
		container.style.left = `${(windowWidth - nominalWidth * scale) / 2}px`;
		container.style.top = `${(windowHeight - nominalHeight * scale) / 2}px`;
		container.style.position = 'absolute';
	}


	// Call resizeCanvas on window resize
	window.addEventListener('resize', scaleContainer);

	// Initial call to set the canvas size
	window.addEventListener('load', () => {
		scaleContainer();
	});
})();
