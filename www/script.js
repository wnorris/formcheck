let detector = null;
let startFrameNum1 = null, endFrameNum1 = null;
let startFrameNum2 = null, endFrameNum2 = null;
let video1Ready = false, video2Ready = false;
let isVideoSetupCollapsed = false;
let currentFrameIndex = 0;

// Update opacity defaults
let opacityValues = {
  frame1: 1.0,
  frame2: 0.5,
  pose1: 1.0,
  pose2: 1.0
};

document.addEventListener('DOMContentLoaded', () => {
  setupVideoUpload(1);
  setupVideoUpload(2);
  setupCardCollapse();
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

  // Create the existing 2D view container
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';

  // Create canvases for both videos
  const frame1Canvas = document.createElement('canvas');
  const frame2Canvas = document.createElement('canvas');
  const pose1Canvas = document.createElement('canvas');
  const pose2Canvas = document.createElement('canvas');

  [frame1Canvas, frame2Canvas, pose1Canvas, pose2Canvas].forEach(canvas => {
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
  });

  frame1Canvas.style.opacity = '1.0';
  frame2Canvas.style.opacity = '0.5';
  pose1Canvas.style.opacity = '1';
  pose2Canvas.style.opacity = '1';

  frame1Canvas.style.zIndex = '1';
  frame2Canvas.style.zIndex = '2';
  pose1Canvas.style.zIndex = '3';
  pose2Canvas.style.zIndex = '4';

  canvasContainer.append(frame1Canvas, frame2Canvas, pose1Canvas, pose2Canvas);

  // Create 3D view container
  const pose3dContainer = document.createElement('div');
  pose3dContainer.className = 'pose-3d-container';
  pose3dContainer.id = `pose3d-${frameNum}`;

  // Add all containers to the comparison container
  comparisonContainer.append(
    canvasContainer, 
    createOpacityControls([
      { label: 'Video 1 Frame', canvas: frame1Canvas, defaultValue: 0.0 },
      { label: 'Video 2 Frame', canvas: frame2Canvas, defaultValue: 0.0 },
      { label: 'Video 1 Skeleton', canvas: pose1Canvas, defaultValue: 1.0 },
      { label: 'Video 2 Skeleton', canvas: pose2Canvas, defaultValue: 1.0 }
    ]),
    pose3dContainer
  );

  div.appendChild(comparisonContainer);

  return {
    div,
    frame1Canvas,
    pose1Canvas,
    frame2Canvas,
    pose2Canvas,
    pose3dContainer
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
    
    // Setup frame navigation with the calculated totalFrames
    setupFrameNavigation(totalFrames);
    
    for (let i = 0; i < totalFrames; i++) {
      const frame1 = Math.floor(startFrameNum1 + (i * step1));
      const frame2 = Math.floor(startFrameNum2 + (i * step2));

      const { div, frame1Canvas, pose1Canvas, frame2Canvas, pose2Canvas, pose3dContainer } = 
        createComparisonFrame(i);
      div.dataset.index = i;
      div.style.display = i === 0 ? 'block' : 'none';
      framesContainer.appendChild(div);

      await processVideoFrames(
        video1, frame1, frame1Canvas, pose1Canvas,
        video2, frame2, frame2Canvas, pose2Canvas,
        pose3dContainer
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
                                video2, frame2Num, frame2Canvas, pose2Canvas,
                                pose3dContainer) {
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
        scoreThreshold: 0.0
      }),
      detector.estimatePoses(frame2Canvas, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.0
      })
    ]);
    
    // Draw poses if detected
    if (poses1.length > 0 && poses2.length > 0) {
      const pose1 = poses1[0];
      const pose2 = poses2[0];

      // Calculate centers of gravity
      const cog1 = calculateCenterOfGravity(pose1);
      const cog2 = calculateCenterOfGravity(pose2);

      // Calculate torso heights
      const torsoHeight1 = calculateTorsoHeight(pose1);
      const torsoHeight2 = calculateTorsoHeight(pose2);

      // Calculate scale factors to normalize torso heights
      const targetHeight = Math.max(torsoHeight1, torsoHeight2);
      const scale1 = targetHeight / torsoHeight1;
      const scale2 = targetHeight / torsoHeight2;

      // Calculate offset needed to align COGs
      const offset1 = {
        x: (cog2.x - cog1.x * scale1) / 2,
        y: (cog2.y - cog1.y * scale1) / 2
      };
      const offset2 = {
        x: (cog1.x - cog2.x * scale2) / 2,
        y: (cog1.y - cog2.y * scale2) / 2
      };

      const ctx1 = pose1Canvas.getContext('2d');
      const ctx2 = pose2Canvas.getContext('2d');

      // Clear canvases
      ctx1.clearRect(0, 0, pose1Canvas.width, pose1Canvas.height);
      ctx2.clearRect(0, 0, pose2Canvas.width, pose2Canvas.height);

      // Draw pose1 with offset and scale to match pose2's COG and torso height
      ctx1.save();
      ctx1.translate(offset1.x, offset1.y);
      ctx1.scale(scale1, scale1);
      drawPose(pose1, ctx1, false);
      ctx1.restore();

      // Draw pose2 with offset and scale to match pose1's COG and torso height
      ctx2.save();
      ctx2.translate(offset2.x, offset2.y);
      ctx2.scale(scale2, scale2);
      drawPose(pose2, ctx2, true);
      ctx2.restore();

      // Clear and redraw frame1 with offset and scale
      frame1Ctx.clearRect(0, 0, frame1Canvas.width, frame1Canvas.height);
      frame1Ctx.save();
      frame1Ctx.translate(offset1.x, offset1.y);
      frame1Ctx.scale(scale1, scale1);
      frame1Ctx.drawImage(video1, 0, 0, frame1Canvas.width, frame1Canvas.height);
      frame1Ctx.restore();

      // Clear and redraw frame2 with offset and scale
      frame2Ctx.clearRect(0, 0, frame2Canvas.width, frame2Canvas.height);
      frame2Ctx.save();
      frame2Ctx.translate(offset2.x, offset2.y);
      frame2Ctx.scale(scale2, scale2);
      frame2Ctx.drawImage(video2, 0, 0, frame2Canvas.width, frame2Canvas.height);
      frame2Ctx.restore();

      // Initialize and update 3D visualization
      const visualizer = new PoseVisualizer(pose3dContainer.id);
      visualizer.updatePoses(poses1[0], poses2[0]);
    }
  } catch (error) {
    console.error('Error processing frames:', error);
  }
}

function calculateTorsoHeight(pose) {
  const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
  const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');

  // Calculate midpoints
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;

  // Return vertical distance between shoulder and hip midpoints
  return Math.abs(shoulderMidY - hipMidY);
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

function drawPose(pose, ctx, isPink = false) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  const color = isPink ? {
    solid: '#FF6CD6', // Solid neon pink
    glow: 'rgba(255, 108, 214, 0.2)'
  } : {
    solid: '#40E0D0', // Solid turquoise 
    glow: 'rgba(64, 224, 208, 0.2)'
  };

  // All connections in one array
  const connections = [
    // Body
    { points: ['nose', 'left_eye'] },
    { points: ['left_eye', 'left_ear'] },
    { points: ['nose', 'right_eye'] },
    { points: ['right_eye', 'right_ear'] },
    { points: ['left_shoulder', 'right_shoulder'] },
    { points: ['left_shoulder', 'left_elbow'] },
    { points: ['left_elbow', 'left_wrist'] },
    { points: ['left_shoulder', 'left_hip'] },
    { points: ['right_shoulder', 'right_hip'] },
    { points: ['left_hip', 'right_hip'] },
    { points: ['left_hip', 'left_knee'] },
    { points: ['left_knee', 'left_ankle'] },
    { points: ['right_hip', 'right_knee'] },
    { points: ['right_knee', 'right_ankle'] },
    // Complete foot connections
    { points: ['left_ankle', 'left_heel'] },
    { points: ['left_heel', 'left_foot_index'] },
    { points: ['left_ankle', 'left_foot_index'] },
    { points: ['right_ankle', 'right_heel'] },
    { points: ['right_heel', 'right_foot_index'] },
    { points: ['right_ankle', 'right_foot_index'] },
    // Arms and hands
    { points: ['right_shoulder', 'right_elbow'] },
    { points: ['right_elbow', 'right_wrist'] },
    { points: ['right_wrist', 'right_pinky'] },
    { points: ['right_wrist', 'right_index'] },
    { points: ['right_wrist', 'right_thumb'] },
    { points: ['right_pinky', 'right_index'] },
    { points: ['right_index', 'right_thumb'] }
  ];

  function drawConnections() {
    for (const connection of connections) {
      const [first, second] = connection.points;
      const firstPoint = pose.keypoints.find(kp => kp.name === first);
      const secondPoint = pose.keypoints.find(kp => kp.name === second);
      
      if (firstPoint && secondPoint && 
          firstPoint.score > 0.3 && secondPoint.score > 0.3) {
        // Draw glow
        ctx.beginPath();
        ctx.strokeStyle = color.glow;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.stroke();

        // Draw solid line
        ctx.beginPath();
        ctx.strokeStyle = color.solid;
        ctx.lineWidth = 3;
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.stroke();
      }
    }
  }

  function drawKeypoints() {
    for (const keypoint of pose.keypoints) {
      if (keypoint.score > 0.3) {
        // Draw glow
        ctx.beginPath();
        ctx.fillStyle = color.glow;
        ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw solid point
        ctx.beginPath();
        ctx.fillStyle = color.solid;
        ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // Add shadow effect
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw everything in one pass
  drawConnections();
  drawKeypoints();
}

function setupCardCollapse() {
  const cardHeader = document.querySelector('.card-header');
  const cardContent = document.querySelector('.card-content');
  const toggleBtn = document.querySelector('.toggle-btn');

  function toggleCollapse() {
    isVideoSetupCollapsed = !isVideoSetupCollapsed;
    cardContent.classList.toggle('collapsed', isVideoSetupCollapsed);
    toggleBtn.classList.toggle('collapsed', isVideoSetupCollapsed);
  }

  cardHeader.addEventListener('click', toggleCollapse);

  // Update processBtn click handler
  const processBtn = document.getElementById('processBtn');
  processBtn.addEventListener('click', async () => {
    toggleCollapse();
    await processVideos();
  });
}

function showFrame(index, totalFrames) {
  const frames = document.querySelectorAll('.frame-pair');
  frames.forEach((frame, i) => {
    frame.style.display = i === index ? 'block' : 'none';
  });
  
  const prevBtn = document.getElementById('prevFrameBtn');
  const nextBtn = document.getElementById('nextFrameBtn');
  const frameIndicator = document.getElementById('frameIndicator');
  
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === totalFrames - 1;
  frameIndicator.textContent = `Frame ${index + 1} of ${totalFrames}`;
}

function setupFrameNavigation(totalFrames) {
  // Wait for frames to be created before setting up navigation
  setTimeout(() => {
    const prevBtn = document.getElementById('prevFrameBtn');
    const nextBtn = document.getElementById('nextFrameBtn');
    
    prevBtn.onclick = () => {
      if (currentFrameIndex > 0) {
        currentFrameIndex--;
        showFrame(currentFrameIndex, totalFrames);
      }
    };
    
    nextBtn.onclick = () => {
      if (currentFrameIndex < totalFrames - 1) {
        currentFrameIndex++;
        showFrame(currentFrameIndex, totalFrames);
      }
    };

    // Show first frame
    showFrame(0, totalFrames);
  }, 0);
}
