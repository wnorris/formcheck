let detector;
let allPoses = [];

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const poseCanvas = document.getElementById('poseCanvas');
  const videoUpload = document.getElementById('videoUpload');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  const poseCtx = poseCanvas.getContext('2d');

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

  async function processAllFrames() {
    allPoses = [];
    const frameCount = Math.floor(video.duration * 30); // Assuming 30fps
    
    // Create an offscreen canvas for frame extraction
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = video.videoWidth;
    offscreenCanvas.height = video.videoHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i / 30;
      
      await new Promise(resolve => {
        video.onseeked = () => {
          // Draw the frame to offscreen canvas
          offscreenCtx.drawImage(video, 0, 0);
          resolve();
        };
      });

      try {
        const poses = await detector.estimatePoses(offscreenCanvas, {
          maxPoses: 1,
          flipHorizontal: false,
          scoreThreshold: 0.3
        });
        
        if (poses.length > 0) {
          allPoses[i] = poses[0];
          console.log(`Frame ${i}: Pose detected`, poses[0]);
        }
        
        const progress = (i / frameCount) * 100;
        showLoading(true, progress);
      } catch (error) {
        console.error('Error processing frame:', error);
      }
    }
    
    showLoading(false);
    return allPoses;
  }

  function drawPose(pose, ctx) {
    // Clear canvas
    ctx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    
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
    video.src = URL.createObjectURL(file);
    
    video.onloadeddata = async () => {
      // Wait for video to be fully loaded
      await new Promise(resolve => {
        if (video.readyState >= 3) {
          resolve();
        } else {
          video.addEventListener('canplay', () => resolve());
        }
      });

      // Set canvas size to match video
      poseCanvas.width = video.videoWidth;
      poseCanvas.height = video.videoHeight;

      if (!detector) {
        await initPoseDetection();
      }
      
      // Process all frames
      video.pause();
      await processAllFrames();
      
      // Add timeupdate listener to draw poses during playback
      video.addEventListener('timeupdate', () => {
        const currentFrame = Math.floor(video.currentTime * 30);
        console.log('Current frame:', currentFrame, 'Pose:', allPoses[currentFrame]);
        if (allPoses[currentFrame]) {
          drawPose(allPoses[currentFrame], poseCtx);
        }
        console.log('Video time:', video.currentTime, 'Frame:', currentFrame);
      });
      
      // Ready to play
      video.currentTime = 0;
    };
  });
});
