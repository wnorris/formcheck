class PoseVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a2a);

        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 2;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Materials for different poses
        this.materials = {
            pose1: new THREE.LineBasicMaterial({ color: 0x40E0D0 }),
            pose2: new THREE.LineBasicMaterial({ color: 0xFF6CD6 })
        };

        this.animate();
    }

    updatePoses(pose1, pose2) {
        // Clear existing lines
        this.scene.children = [];

        if (pose1) this.drawPose(pose1, this.materials.pose1);
        if (pose2) this.drawPose(pose2, this.materials.pose2);
    }

    drawPose(pose, material) {
        const connections = [
            ['nose', 'left_eye'], ['left_eye', 'left_ear'], ['nose', 'right_eye'],
            ['right_eye', 'right_ear'], ['left_shoulder', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
            ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
            ['left_hip', 'right_hip'], ['left_hip', 'left_knee'],
            ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'],
            ['right_knee', 'right_ankle'], ['right_shoulder', 'right_elbow'],
            ['right_elbow', 'right_wrist']
        ];

        connections.forEach(([start, end]) => {
            const startPoint = pose.keypoints3D.find(kp => kp.name === start);
            const endPoint = pose.keypoints3D.find(kp => kp.name === end);

            if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(startPoint.x, -startPoint.y, -startPoint.z),
                    new THREE.Vector3(endPoint.x, -endPoint.y, -endPoint.z)
                ]);
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
} 