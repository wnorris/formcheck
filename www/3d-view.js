class PoseVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 2;

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        // Controls setup
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Grid helper
        const gridHelper = new THREE.GridHelper(2, 20);
        this.scene.add(gridHelper);

        // Points material
        this.pointsMaterial = new THREE.PointsMaterial({
            color: 0x00ff00,
            size: 0.03,
            sizeAttenuation: true
        });

        // Lines material
        this.linesMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1
        });

        // Initialize empty points
        this.points = new THREE.Points(
            new THREE.BufferGeometry(),
            this.pointsMaterial
        );
        this.scene.add(this.points);

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    // Define connections between keypoints for drawing lines
    static POSE_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 7], // Face
        [0, 4], [4, 5], [5, 6], [6, 8], // Face
        [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], // Left arm and hand
        [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], // Right arm and hand
        [11, 23], [23, 25], [25, 27], [27, 29], [27, 31], // Left leg and foot
        [12, 24], [24, 26], [26, 28], [28, 30], [28, 32], // Right leg and foot
    ];

    updatePose(landmarks) {
        // Convert landmarks to Three.js positions
        const positions = new Float32Array(landmarks.length * 3);
        landmarks.forEach((landmark, i) => {
            positions[i * 3] = landmark.x - 0.5;     // Center x
            positions[i * 3 + 1] = -landmark.y + 0.5; // Invert and center y
            positions[i * 3 + 2] = -landmark.z;      // Scale z appropriately
        });

        // Update points
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.points.geometry.dispose();
        this.points.geometry = geometry;

        // Update connections
        this.updateConnections(positions);
    }

    updateConnections(positions) {
        // Remove old lines
        this.scene.remove(...this.scene.children.filter(child => child instanceof THREE.Line));

        // Create new lines for each connection
        PoseVisualizer.POSE_CONNECTIONS.forEach(([i, j]) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const line = new THREE.Line(geometry, this.linesMaterial);
            this.scene.add(line);
        });
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Example of how to update the pose with new landmarks
// This would typically be called when you get new pose detection results
function updateWithNewPose(poseLandmarks) {
    visualizer.updatePose(poseLandmarks);
}

// Function to load the specific pose
function loadSpecificPose() {
    const poseData = [{"x":0.27787350062890614,"y":-0.5195844935502206,"z":-0.07314801216125488,"score":0.9999891554708813,"name":"nose"},{"x":0.26609818093636367,"y":-0.5633322151094367,"z":-0.06580543518066406,"score":0.9999849089944687,"name":"left_eye_inner"},{"x":0.26625138781415364,"y":-0.5635965772858921,"z":-0.0647885799407959,"score":0.9999806325844459,"name":"left_eye"},{"x":0.26628174657908593,"y":-0.5641154066491676,"z":-0.06461262702941895,"score":0.9999845835350657,"name":"left_eye_outer"},{"x":0.25748301056446055,"y":-0.5574429623762316,"z":-0.09812259674072266,"score":0.9999869664854503,"name":"right_eye_inner"},{"x":0.25816825985104247,"y":-0.5583254526850386,"z":-0.09850335121154785,"score":0.9999839245364895,"name":"right_eye"},{"x":0.2582592906116081,"y":-0.5595581764237825,"z":-0.09787416458129883,"score":0.9999815634918982,"name":"right_eye_outer"},{"x":0.17446320283148595,"y":-0.6090162938521857,"z":0.016438007354736328,"score":0.9999769945444025,"name":"left_ear"},{"x":0.1376615198214745,"y":-0.5893828882164032,"z":-0.14254474639892578,"score":0.9999865947730051,"name":"right_ear"},{"x":0.24055361025000516,"y":-0.518521824096973,"z":-0.038077592849731445,"score":0.9999907579514217,"name":"mouth_left"},{"x":0.23003434952538682,"y":-0.5114079017338299,"z":-0.08168816566467285,"score":0.9999927332582822,"name":"mouth_right"},{"x":0.18772775321547613,"y":-0.46901285448321484,"z":0.116778165102005,"score":0.9999850871968308,"name":"left_shoulder"},{"x":-0.0002164490899755761,"y":-0.48959382897511217,"z":-0.15267300605773926,"score":0.9999889028970708,"name":"right_shoulder"},{"x":0.2638210495621598,"y":-0.29516933529466477,"z":0.17030346393585205,"score":0.7310984213113148,"name":"left_elbow"},{"x":-0.14653551772571874,"y":-0.3418752244905592,"z":-0.24174846708774567,"score":0.992575205469069,"name":"right_elbow"},{"x":0.4144043562624358,"y":-0.17626307079223022,"z":0.06811857223510742,"score":0.9338424825359781,"name":"left_wrist"},{"x":-0.19641889334525237,"y":-0.2021813546053786,"z":-0.3728741407394409,"score":0.9920690585919775,"name":"right_wrist"},{"x":0.45069643707468093,"y":-0.13185800368745587,"z":0.05762481689453125,"score":0.9030579405125081,"name":"left_pinky"},{"x":-0.21516503662613412,"y":-0.1512282684367779,"z":-0.4123048782348633,"score":0.9872133518032447,"name":"right_pinky"},{"x":0.46389374542658357,"y":-0.13705276094738375,"z":0.018607378005981445,"score":0.9186904292294176,"name":"left_index"},{"x":-0.18493872829185726,"y":-0.1489044093966689,"z":-0.42804431915283203,"score":0.9869714861392425,"name":"right_index"},{"x":0.42395175251769307,"y":-0.1687089734572213,"z":0.04868483543395996,"score":0.9066689802871667,"name":"left_thumb"},{"x":-0.18610253661515436,"y":-0.18688286581105212,"z":-0.38328802585601807,"score":0.9777314084132266,"name":"right_thumb"},{"x":0.07139560297256947,"y":0.003219918073556252,"z":0.08726835250854492,"score":0.9998058584931773,"name":"left_hip"},{"x":-0.07165148669152434,"y":-0.0035227015509126432,"z":-0.08640384674072266,"score":0.9995378329928981,"name":"right_hip"},{"x":0.21435620509733774,"y":0.36404495565781053,"z":0.015467405319213867,"score":0.94916822603837,"name":"left_knee"},{"x":-0.12265754777696022,"y":0.3745812379576898,"z":-0.08526444435119629,"score":0.9928445796246983,"name":"right_knee"},{"x":0.2447843200045051,"y":0.7607749521543435,"z":0.006044864654541016,"score":0.9723572928632487,"name":"left_ankle"},{"x":-0.25649475591513554,"y":0.7262840138973577,"z":-0.05797576904296875,"score":0.9915755504576134,"name":"right_ankle"},{"x":0.2581446263409037,"y":0.8104848360797903,"z":-0.004841327667236328,"score":0.9558205241783448,"name":"left_heel"},{"x":-0.26798968702104287,"y":0.7715585559810316,"z":-0.06499719619750977,"score":0.9378990724969801,"name":"right_heel"},{"x":0.4015258663983229,"y":0.8508425633113071,"z":-0.0751032829284668,"score":0.973627768456034,"name":"left_foot_index"},{"x":-0.18338218557151179,"y":0.824851961859278,"z":-0.1793208122253418,"score":0.983332967551823,"name":"right_foot_index"}];

    // Scale factor to make the visualization more visible
    const scaleFactor = 2;
    
    // Create scaled landmarks array
    const scaledLandmarks = poseData.map(point => ({
        x: point.x * scaleFactor,
        y: point.y * scaleFactor,
        z: point.z * scaleFactor
    }));

    // Update the visualization
    visualizer.updatePose(scaledLandmarks);
}

// Initialize the visualizer
const visualizer = new PoseVisualizer('container');

// Load the specific pose immediately
loadSpecificPose(); 
