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
  
  const colors = {
    rightSide: {
      solid: '#FF6CD6', // Solid neon pink
      glow: 'rgba(255, 108, 214, 0.2)'
    },
    body: {
      solid: '#40E0D0', // Solid turquoise
      glow: 'rgba(64, 224, 208, 0.2)'
    }
  };

  // Split connections into body and right arm for layered drawing
  const bodyConnections = [
    // Body
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
    { points: ['right_knee', 'right_ankle'], group: 'body' },
    // Complete foot connections
    { points: ['left_ankle', 'left_heel'], group: 'body' },
    { points: ['left_heel', 'left_foot_index'], group: 'body' },
    { points: ['left_ankle', 'left_foot_index'], group: 'body' },
    { points: ['right_ankle', 'right_heel'], group: 'body' },
    { points: ['right_heel', 'right_foot_index'], group: 'body' },
    { points: ['right_ankle', 'right_foot_index'], group: 'body' }
  ];

  const rightArmConnections = [
    { points: ['right_shoulder', 'right_elbow'], group: 'rightSide' },
    { points: ['right_elbow', 'right_wrist'], group: 'rightSide' },
    { points: ['right_wrist', 'right_pinky'], group: 'rightSide' },
    { points: ['right_wrist', 'right_index'], group: 'rightSide' },
    { points: ['right_wrist', 'right_thumb'], group: 'rightSide' },
    { points: ['right_pinky', 'right_index'], group: 'rightSide' },
    { points: ['right_index', 'right_thumb'], group: 'rightSide' }
  ];

  function drawConnections(connections) {
    for (const connection of connections) {
      const [first, second] = connection.points;
      const firstPoint = pose.keypoints.find(kp => kp.name === first);
      const secondPoint = pose.keypoints.find(kp => kp.name === second);
      const colorGroup = colors[connection.group];
      
      if (firstPoint && secondPoint && 
          firstPoint.score > 0.3 && secondPoint.score > 0.3) {
        // Draw glow
        ctx.beginPath();
        ctx.strokeStyle = colorGroup.glow;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.stroke();

        // Draw solid line
        ctx.beginPath();
        ctx.strokeStyle = colorGroup.solid;
        ctx.lineWidth = 3;
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.stroke();
      }
    }
  }

  function drawKeypoints(isRightSide) {
    for (const keypoint of pose.keypoints) {
      if (keypoint.score > 0.3) {
        const isRightArm = [
          'right_shoulder', 
          'right_elbow', 
          'right_wrist',
          'right_pinky',
          'right_index',
          'right_thumb'
        ].includes(keypoint.name);
        
        if (isRightArm === isRightSide) {
          const colorGroup = isRightArm ? colors.rightSide : colors.body;
          
          // Draw glow
          ctx.beginPath();
          ctx.fillStyle = colorGroup.glow;
          ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
          ctx.fill();

          // Draw solid point
          ctx.beginPath();
          ctx.fillStyle = colorGroup.solid;
          ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }

  // Add shadow effect
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw body first
  drawConnections(bodyConnections);
  drawKeypoints(false);

  // Draw right arm on top
  drawConnections(rightArmConnections);
  drawKeypoints(true);
}
