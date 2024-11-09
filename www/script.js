let detector = null;
let startFrameNum = null;
let endFrameNum = null;

document.addEventListener('DOMContentLoaded', () => {
  const videoUpload = document.getElementById('videoUpload');
  const frameSelector = document.getElementById('frameSelector');
  const previewVideo = document.getElementById('previewVideo');
  const setStartBtn = document.getElementById('setStartBtn');
  const setEndBtn = document.getElementById('setEndBtn');
  const processBtn = document.getElementById('processBtn');
  const startFrameSpan = document.getElementById('startFrame');
  const endFrameSpan = document.getElementById('endFrame');
  const framesContainer = document.getElementById('framesContainer');
  
  function updateProcessButton() {
    processBtn.disabled = startFrameNum === null || endFrameNum === null;
  }
  
  setStartBtn.addEventListener('click', () => {
    startFrameNum = Math.floor(previewVideo.currentTime * 30);
    startFrameSpan.textContent = startFrameNum;
    updateProcessButton();
  });
  
  setEndBtn.addEventListener('click', () => {
    endFrameNum = Math.floor(previewVideo.currentTime * 30);
    endFrameSpan.textContent = endFrameNum;
    updateProcessButton();
  });
  
  processBtn.addEventListener('click', async () => {
    if (startFrameNum === null || endFrameNum === null) return;
    
    frameSelector.classList.add('hidden');
    await processFrameRange(previewVideo, startFrameNum, endFrameNum);
  });

  videoUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset state
    startFrameNum = null;
    endFrameNum = null;
    startFrameSpan.textContent = 'Not set';
    endFrameSpan.textContent = 'Not set';
    processBtn.disabled = true;
    framesContainer.innerHTML = '';
    
    // Show frame selector and setup preview
    frameSelector.classList.remove('hidden');
    previewVideo.src = URL.createObjectURL(file);

    previewVideo.onerror = (e) => {
      console.error('Error loading video:', e);
      alert('Error loading video. Please try another file.');
    };
  });
});

async function processFrameRange(video, startFrame, endFrame) {
  showLoading(true, 0);
  
  if (!detector) {
    try {
      await initPoseDetection();
    } catch (error) {
      showLoading(false);
      console.error('Failed to initialize pose detection:', error);
      return;
    }
  }

  const frameCount = endFrame - startFrame;
  const frameStep = Math.max(1, Math.floor(frameCount / 50)); // Max 50 frames
  
  for (let i = startFrame; i <= endFrame; i += frameStep) {
    video.currentTime = i / 30;
    
    await new Promise(resolve => {
      video.onseeked = resolve;
    });

    const { div, frameCanvas, poseCanvas } = createFramePair(i);
    framesContainer.appendChild(div);

    const frameCtx = frameCanvas.getContext('2d');
    frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);

    try {
      const poses = await detector.estimatePoses(frameCanvas, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.3
      });
      
      if (poses.length > 0) {
        drawPose(poses[0], poseCanvas.getContext('2d'));
      }
      
      const progress = ((i - startFrame) / frameCount) * 100;
      showLoading(true, progress);
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  }
  
  showLoading(false);
}

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
  const loadingIndicator = document.getElementById('loadingIndicator');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
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
  
  // Modern color scheme
  const colors = {
    rightArm: {
      joint: 'rgba(255, 107, 107, 0.8)', // Soft red
      line: 'rgba(255, 107, 107, 0.6)'
    },
    body: {
      joint: 'rgba(100, 149, 237, 0.8)', // Soft blue
      line: 'rgba(100, 149, 237, 0.6)'
    }
  };

  // Define connections with color groups
  const connections = [
    // Right arm (red)
    { points: ['right_shoulder', 'right_elbow'], group: 'rightArm' },
    { points: ['right_elbow', 'right_wrist'], group: 'rightArm' },
    
    // Rest of body (blue)
    { points: ['nose', 'left_eye'], group: 'body' },
    { points: ['left_eye', 'left_ear'], group: 'body' },
    { points: ['nose', 'right_eye'], group: 'body' },
    { points: ['right_eye', 'right_ear'], group: 'body' },
    { points: ['left_shoulder', 'right_shoulder'], group: 'body' },
    { points: ['left_shoulder', 'left_elbow'], group: 'body' },
    { points: ['left_elbow', 'left_wrist'], group: 'body' },
    { points: ['left_shoulder', 'left_hip'], group: 'body' },
    { points: ['right_shoulder', 'right_hip'], group: 'body' },
    { points: ['left_hip', 'right_hip'], group: 'body' },
    { points: ['left_hip', 'left_knee'], group: 'body' },
    { points: ['left_knee', 'left_ankle'], group: 'body' },
    { points: ['right_hip', 'right_knee'], group: 'body' },
    { points: ['right_knee', 'right_ankle'], group: 'body' }
  ];

  // Draw skeleton with glow effect
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw connections
  for (const connection of connections) {
    const [first, second] = connection.points;
    const firstPoint = pose.keypoints.find(kp => kp.name === first);
    const secondPoint = pose.keypoints.find(kp => kp.name === second);
    const colorGroup = colors[connection.group];
    
    if (firstPoint && secondPoint && 
        firstPoint.score > 0.3 && secondPoint.score > 0.3) {
      // Draw glow effect
      ctx.beginPath();
      ctx.strokeStyle = colorGroup.line;
      ctx.lineWidth = 8;
      ctx.moveTo(firstPoint.x, firstPoint.y);
      ctx.lineTo(secondPoint.x, secondPoint.y);
      ctx.stroke();

      // Draw main line
      ctx.beginPath();
      ctx.strokeStyle = colorGroup.joint;
      ctx.lineWidth = 3;
      ctx.moveTo(firstPoint.x, firstPoint.y);
      ctx.lineTo(secondPoint.x, secondPoint.y);
      ctx.stroke();
    }
  }

  // Draw keypoints with glow
  for (const keypoint of pose.keypoints) {
    if (keypoint.score > 0.3) {
      const isRightArm = ['right_shoulder', 'right_elbow', 'right_wrist'].includes(keypoint.name);
      const colorGroup = isRightArm ? colors.rightArm : colors.body;

      // Draw glow
      ctx.beginPath();
      ctx.fillStyle = colorGroup.line;
      ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw point
      ctx.beginPath();
      ctx.fillStyle = colorGroup.joint;
      ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
