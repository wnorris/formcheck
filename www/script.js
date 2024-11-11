let detector = null;
let startFrameNum1 = null, endFrameNum1 = null;
let startFrameNum2 = null, endFrameNum2 = null;
let video1Ready = false, video2Ready = false;

document.addEventListener('DOMContentLoaded', () => {
  setupVideoUpload(1);
  setupVideoUpload(2);
  
  const processBtn = document.getElementById('processBtn');
  processBtn.addEventListener('click', async () => {
    await processVideos();
  });
});

function setupVideoUpload(videoNum) {
  const videoUpload = document.getElementById(`videoUpload${videoNum}`);
  const frameSelector = document.getElementById(`frameSelector${videoNum}`);
  const previewVideo = document.getElementById(`previewVideo${videoNum}`);
  const setStartBtn = document.getElementById(`setStartBtn${videoNum}`);
  const setEndBtn = document.getElementById(`setEndBtn${videoNum}`);
  const startFrameSpan = document.getElementById(`startFrame${videoNum}`);
  const endFrameSpan = document.getElementById(`endFrame${videoNum}`);

  videoUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    resetVideoState(videoNum);
    frameSelector.classList.remove('hidden');
    previewVideo.src = URL.createObjectURL(file);
    previewVideo.playbackRate = 0.25;

    // Wait for video metadata to load
    await new Promise(resolve => {
      previewVideo.onloadedmetadata = resolve;
    });

    // Set default start/end frames
    if (videoNum === 1) {
      startFrameNum1 = 0;
      endFrameNum1 = Math.floor(previewVideo.duration * 30) - 1;
      startFrameSpan.textContent = startFrameNum1;
      endFrameSpan.textContent = endFrameNum1;
    } else {
      startFrameNum2 = 0;
      endFrameNum2 = Math.floor(previewVideo.duration * 30) - 1;
      startFrameSpan.textContent = startFrameNum2;
      endFrameSpan.textContent = endFrameNum2;
    }
    
    updateProcessButton();
  });

  setStartBtn.addEventListener('click', () => {
    if (videoNum === 1) {
      startFrameNum1 = Math.floor(previewVideo.currentTime * 30);
      startFrameSpan.textContent = startFrameNum1;
    } else {
      startFrameNum2 = Math.floor(previewVideo.currentTime * 30);
      startFrameSpan.textContent = startFrameNum2;
    }
    updateProcessButton();
  });

  setEndBtn.addEventListener('click', () => {
    if (videoNum === 1) {
      endFrameNum1 = Math.floor(previewVideo.currentTime * 30);
      endFrameSpan.textContent = endFrameNum1;
    } else {
      endFrameNum2 = Math.floor(previewVideo.currentTime * 30);
      endFrameSpan.textContent = endFrameNum2;
    }
    updateProcessButton();
  });
}

function createComparisonFrame(frameNum) {
  const div = document.createElement('div');
  div.className = 'frame-pair';

  const comparisonContainer = document.createElement('div');
  comparisonContainer.className = 'comparison-container';

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';

  // Create canvases for both videos
  const frame1Canvas = document.createElement('canvas');
  const frame2Canvas = document.createElement('canvas');
  const pose1Canvas = document.createElement('canvas');
  const pose2Canvas = document.createElement('canvas');

  // Set initial properties for all canvases
  [frame1Canvas, frame2Canvas, pose1Canvas, pose2Canvas].forEach(canvas => {
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
  });

  // Set initial opacities
  frame1Canvas.style.opacity = '0.0';
  frame2Canvas.style.opacity = '0.0';
  pose1Canvas.style.opacity = '1';
  pose2Canvas.style.opacity = '1';

  // Set z-index to ensure poses are on top
  frame1Canvas.style.zIndex = '1';
  frame2Canvas.style.zIndex = '2';
  pose1Canvas.style.zIndex = '3';
  pose2Canvas.style.zIndex = '4';

  // Add canvases in the correct order
  canvasContainer.append(frame1Canvas, frame2Canvas, pose1Canvas, pose2Canvas);
  comparisonContainer.appendChild(canvasContainer);

  // Create opacity controls for all layers
  const opacityControls = createOpacityControls([
    { label: 'Video 1 Frame', canvas: frame1Canvas, defaultValue: 0.0 },
    { label: 'Video 2 Frame', canvas: frame2Canvas, defaultValue: 0.0 },
    { label: 'Video 1 Skeleton', canvas: pose1Canvas, defaultValue: 1.0 },
    { label: 'Video 2 Skeleton', canvas: pose2Canvas, defaultValue: 1.0 }
  ]);

  div.append(comparisonContainer, opacityControls);

  return {
    div,
    frame1Canvas,
    pose1Canvas,
    frame2Canvas,
    pose2Canvas
  };
}

function createOpacityControls(layers) {
  const controls = document.createElement('div');
  controls.className = 'opacity-controls';

  layers.forEach(layer => {
    const slider = document.createElement('div');
    slider.className = 'opacity-slider';
    
    const label = document.createElement('label');
    label.textContent = layer.label;
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.1';
    input.value = layer.defaultValue;
    input.addEventListener('input', () => {
      layer.canvas.style.opacity = input.value;
    });

    slider.append(label, input);
    controls.appendChild(slider);
  });

  return controls;
}

async function processVideos() {
  const framesContainer = document.getElementById('framesContainer');
  framesContainer.innerHTML = '';
  showLoading(true, 0);

  try {
    if (!detector) {
      await initPoseDetection();
    }

    const video1 = document.getElementById('previewVideo1');
    const video2 = document.getElementById('previewVideo2');

    // Calculate frame steps to roughly align the videos
    const frameCount1 = endFrameNum1 - startFrameNum1;
    const frameCount2 = endFrameNum2 - startFrameNum2;
    const totalFrames = Math.min(50, Math.min(frameCount1, frameCount2));
    const step1 = frameCount1 / totalFrames;
    const step2 = frameCount2 / totalFrames;

    for (let i = 0; i < totalFrames; i++) {
      const frame1 = Math.floor(startFrameNum1 + (i * step1));
      const frame2 = Math.floor(startFrameNum2 + (i * step2));

      const { div, frame1Canvas, pose1Canvas, frame2Canvas, pose2Canvas } = 
        createComparisonFrame(i);
      framesContainer.appendChild(div);

      // Process both videos together
      await processVideoFrames(
        video1, frame1, frame1Canvas, pose1Canvas,
        video2, frame2, frame2Canvas, pose2Canvas
      );

      const progress = ((i + 1) / totalFrames) * 100;
      showLoading(true, progress);
    }
  } catch (error) {
    console.error('Error processing videos:', error);
    alert('An error occurred while processing the videos. Please try again.');
  } finally {
    showLoading(false);
  }
}

async function processVideoFrames(video1, frame1Num, frame1Canvas, pose1Canvas, 
                                video2, frame2Num, frame2Canvas, pose2Canvas) {
  // Seek both videos to correct frames
  video1.currentTime = frame1Num / 30;
  video2.currentTime = frame2Num / 30;
  await Promise.all([
    new Promise(resolve => { video1.onseeked = resolve; }),
    new Promise(resolve => { video2.onseeked = resolve; })
  ]);

  // Draw frames
  const frame1Ctx = frame1Canvas.getContext('2d');
  const frame2Ctx = frame2Canvas.getContext('2d');
  frame1Ctx.drawImage(video1, 0, 0, frame1Canvas.width, frame1Canvas.height);
  frame2Ctx.drawImage(video2, 0, 0, frame2Canvas.width, frame2Canvas.height);

  try {
    // Get poses for both frames
    const [poses1, poses2] = await Promise.all([
      detector.estimatePoses(frame1Canvas, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.3
      }),
      detector.estimatePoses(frame2Canvas, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.3
      })
    ]);
    
    // Draw poses if detected
    if (poses1.length > 0 && poses2.length > 0) {
      const pose1 = poses1[0];
      const pose2 = poses2[0];

      // Calculate centers of gravity
      const cog1 = calculateCenterOfGravity(pose1);
      const cog2 = calculateCenterOfGravity(pose2);

      // Calculate offset needed to align COGs
      const offset = {
        x: cog2.x - cog1.x,
        y: cog2.y - cog1.y
      };

      const ctx1 = pose1Canvas.getContext('2d');
      const ctx2 = pose2Canvas.getContext('2d');

      // Clear canvases
      ctx1.clearRect(0, 0, pose1Canvas.width, pose1Canvas.height);
      ctx2.clearRect(0, 0, pose2Canvas.width, pose2Canvas.height);

      // Draw pose1 with offset to match pose2's COG
      ctx1.save();
      ctx1.translate(offset.x, offset.y);
      drawPose(pose1, ctx1);
      ctx1.restore();

      // Draw pose2 normally
      drawPose(pose2, ctx2);

      // Clear the frame1 canvas and redraw with cog offset.
      frame1Ctx.clearRect(0, 0, frame1Canvas.width, frame1Canvas.height);
      frame1Ctx.translate(offset.x, offset.y);
      frame1Ctx.drawImage(video1, 0, 0, frame1Canvas.width, frame1Canvas.height);
    }
  } catch (error) {
    console.error('Error processing frames:', error);
  }
}

function calculateCenterOfGravity(pose) {
  const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
  const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');

  const x = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const y = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

  return { x, y };
}

function updateProcessButton() {
  const processBtn = document.getElementById('processBtn');
  processBtn.disabled = !(
    startFrameNum1 !== null && 
    endFrameNum1 !== null && 
    startFrameNum2 !== null && 
    endFrameNum2 !== null
  );
}

function resetVideoState(videoNum) {
  if (videoNum === 1) {
    startFrameNum1 = null;
    endFrameNum1 = null;
    document.getElementById('startFrame1').textContent = 'Not set';
    document.getElementById('endFrame1').textContent = 'Not set';
  } else {
    startFrameNum2 = null;
    endFrameNum2 = null;
    document.getElementById('startFrame2').textContent = 'Not set';
    document.getElementById('endFrame2').textContent = 'Not set';
  }
  updateProcessButton();
}

function showLoading(show, progress = 0) {
  let loadingIndicator = document.getElementById('loadingIndicator');
  
  // Create loading indicator if it doesn't exist
  if (!loadingIndicator) {
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator hidden';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.id = 'progressFill';
    progressFill.className = 'progress-fill';
    
    const progressText = document.createElement('div');
    progressText.id = 'progressText';
    progressText.className = 'progress-text';
    
    progressBar.appendChild(progressFill);
    loadingIndicator.appendChild(progressBar);
    loadingIndicator.appendChild(progressText);
    document.body.appendChild(loadingIndicator);
  }

  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  loadingIndicator.classList.toggle('hidden', !show);
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `Processing frames: ${Math.round(progress)}%`;
}

async function initPoseDetection() {
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
  } catch (error) {
    console.error('Error initializing pose detection:', error);
    throw error;
  }
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
