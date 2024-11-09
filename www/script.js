let detector;

document.addEventListener('DOMContentLoaded', () => {
  const videoUpload = document.getElementById('videoUpload');
  const framesContainer = document.getElementById('framesContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  async function initPoseDetection() {
    showLoading(true, 0);
    try {
      const model = poseDetection.SupportedModels.BlazePose;
      const detectorConfig = {
        runtime: 'tfjs',
        modelType: 'full',
        enableSmoothing: true,
        enableSegmentation: false,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose'
      };
      detector = await poseDetection.createDetector(model, detectorConfig);
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show, progress = 0) {
    loadingIndicator.classList.toggle('hidden', !show);
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Processing frames: ${Math.round(progress)}%`;
  }

  function createFramePair(frameNumber) {
    const div = document.createElement('div');
    div.className = 'frame-pair';
    
    const numberDiv = document.createElement('div');
    numberDiv.className = 'frame-number';
    numberDiv.textContent = `#${frameNumber}`;
    div.appendChild(numberDiv);

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = 400;
    frameCanvas.height = 300;
    div.appendChild(frameCanvas);

    const poseCanvas = document.createElement('canvas');
    poseCanvas.width = 400;
    poseCanvas.height = 300;
    div.appendChild(poseCanvas);

    return { div, frameCanvas, poseCanvas };
  }

  function drawPose(pose, ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw keypoints
    for (const keypoint of pose.keypoints) {
      if (keypoint.score > 0.3) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
      }
    }

    // Define connections for skeleton
    const connections = [
      ['nose', 'left_eye'], ['left_eye', 'left_ear'],
      ['nose', 'right_eye'], ['right_eye', 'right_ear'],
      ['left_shoulder', 'right_shoulder'], 
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle']
    ];

    // Draw skeleton lines
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    
    for (const [first, second] of connections) {
      const firstPoint = pose.keypoints.find(kp => kp.name === first);
      const secondPoint = pose.keypoints.find(kp => kp.name === second);
      
      if (firstPoint && secondPoint && 
          firstPoint.score > 0.3 && secondPoint.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.stroke();
      }
    }
  }

  videoUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    
    await new Promise(resolve => {
      video.onloadeddata = () => {
        if (video.readyState >= 3) {
          resolve();
        }
      };
      video.load();
    });

    if (!detector) {
      await initPoseDetection();
    }

    // Clear previous frames
    framesContainer.innerHTML = '';
    
    const fps = 30;
    const frameCount = Math.floor(video.duration * fps);
    const frameStep = Math.max(1, Math.floor(frameCount / 50)); // Max 50 frames
    
    for (let i = 0; i < frameCount; i += frameStep) {
      video.currentTime = i / fps;
      
      await new Promise(resolve => {
        video.onseeked = resolve;
      });

      const { div, frameCanvas, poseCanvas } = createFramePair(i);
      framesContainer.appendChild(div);

      // Draw video frame
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);

      // Detect and draw pose
      try {
        const poses = await detector.estimatePoses(frameCanvas, {
          maxPoses: 1,
          flipHorizontal: false,
          scoreThreshold: 0.3
        });
        
        if (poses.length > 0) {
          drawPose(poses[0], poseCanvas.getContext('2d'));
        }
        
        const progress = (i / frameCount) * 100;
        showLoading(true, progress);
      } catch (error) {
        console.error('Error processing frame:', error);
      }
    }
    
    showLoading(false);
    URL.revokeObjectURL(video.src);
  });
});
