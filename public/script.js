document.addEventListener("DOMContentLoaded", () => {
  const originalSize = 1080;
  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const planeEl = document.getElementById("graffitiPlane");
  const cameraEl = document.querySelector("a-entity[camera]");
  const markerEl = document.getElementById("marker");

  const divControlsDrawing = document.getElementById("bottomSectionDrawing");
  const divControlsSaved = document.getElementById("bottomSectionSaved");
  const savedContainer = document.getElementById("savedImages");
  const saveButton = document.getElementById("saveButton");
  const closeButton = document.getElementById("buttonCloseSavedImg");

  // Fondo transparente
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let isDrawing = false;
  let brushColor = document.getElementById("colorPicker").value;
  let currentBrush = "default";
  let lastPoint = null;

  let strokes = [];
  let currentStroke = [];

  // ===== Botones guardar / cerrar =====
  saveButton.addEventListener("click", () => {
    const dataURL = canvas.toDataURL("image/png");
    divControlsDrawing.style.display = "none";
    divControlsSaved.classList.remove("flexSaved");

    const previewImg = document.getElementById("savedPreview");
    previewImg.src = dataURL;
    savedContainer.style.display = "flex";

    // Limpiar canvas (transparente)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    currentStroke = [];
    lastPoint = null;

    const planeMesh = planeEl.getObject3D("mesh");
    if (planeMesh?.material?.map) planeMesh.material.map.needsUpdate = true;
  });

  closeButton.addEventListener("click", () => {
    savedContainer.classList.remove("show");
    setTimeout(() => {
      savedContainer.style.display = "none";
      divControlsDrawing.style.display = "flex";
      divControlsSaved.style.display = "none";
      divControlsSaved.classList.remove("flexSaved");
    }, 300);
  });

  // ===== Controles de UI =====
  document.getElementById("colorPicker").addEventListener("input", (e) => {
    brushColor = e.target.value;
  });

  document.getElementById("brushSelector").addEventListener("change", (e) => {
    currentBrush = e.target.value;
  });

  document.getElementById("drawButton").addEventListener("mousedown", () => (isDrawing = true));
  document.getElementById("drawButton").addEventListener("mouseup", () => {
    isDrawing = false;
    endStroke();
  });
  document.getElementById("drawButton").addEventListener("touchstart", (e) => {
    e.preventDefault();
    isDrawing = true;
  });
  document.getElementById("drawButton").addEventListener("touchend", (e) => {
    e.preventDefault();
    isDrawing = false;
    endStroke();
  });

  document.getElementById("resetButton").addEventListener("click", () => {
    strokes = [];
    redrawCanvas();
  });
  document.getElementById("undoButton").addEventListener("click", () => {
    strokes.pop();
    redrawCanvas();
  });

  function endStroke() {
    if (currentStroke.length > 0) {
      strokes.push(currentStroke);
      currentStroke = [];
    }
    lastPoint = null;
  }

  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / originalSize;
    for (const stroke of strokes) {
      for (let i = 1; i < stroke.length; i++) {
        const p1 = stroke[i - 1];
        const p2 = stroke[i];
        applyBrush(
          ctx,
          { ...p1, x: p1.x * scale, y: p1.y * scale },
          { ...p2, x: p2.x * scale, y: p2.y * scale },
          p2.color,
          p2.brush
        );
      }
    }

    const planeMesh = planeEl.getObject3D("mesh");
    if (planeMesh?.material?.map) planeMesh.material.map.needsUpdate = true;
  }

  function applyBrush(ctx, p1, p2, color, brush) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    switch (brush) {
      case "fatcap":
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.shadowBlur = p2.blur / 1.8;
        ctx.shadowColor = color;
        ctx.save();
        ctx.translate(p2.x, p2.y);
        ctx.beginPath();
        ctx.ellipse(0, 0, p2.size * 1.2, p2.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
        break;

      default:
        ctx.strokeStyle = color;
        ctx.lineWidth = p2.size * 1.5;
        ctx.lineCap = "round";
        ctx.shadowBlur = p2.blur;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        break;
    }
  }

  function draw() {
    const camera = cameraEl.getObject3D("camera");
    const planeMesh = planeEl.getObject3D("mesh");
    const markerObj = markerEl.object3D;
    if (!camera || !planeMesh || !markerObj) {
      lastPoint = null;
      return;
    }

    const raycaster = new THREE.Raycaster();
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    raycaster.set(camPos, camDir);

    const intersects = raycaster.intersectObject(planeMesh);
    if (!intersects.length) {
      lastPoint = null;
      return;
    }

    const uv = intersects[0].uv;
    if (!uv) return;

    // ✅ Ajuste de alineación UV (ya corregido)
    const x = (1 - uv.x) * originalSize;
    const y = uv.y * originalSize;

    const markerPos = new THREE.Vector3();
    markerObj.getWorldPosition(markerPos);
    let distance = camPos.distanceTo(markerPos);

    if (isDrawing) {
      const size = Math.max((distance + 1) ** 2 - 60, 5);
      const blur = Math.max((distance + 1) ** 2 - 100, 5);

      const point = { x, y, color: brushColor, size, blur, brush: currentBrush };
      currentStroke.push(point);

      if (lastPoint) {
        const scale = canvas.width / originalSize;
        applyBrush(
          ctx,
          { ...lastPoint, x: lastPoint.x * scale, y: lastPoint.y * scale },
          { ...point, x: point.x * scale, y: point.y * scale },
          brushColor,
          currentBrush
        );
      } else {
        ctx.beginPath();
        if (currentBrush === "default") {
          ctx.shadowBlur = blur;
          ctx.shadowColor = brushColor;
        }
        const scale = canvas.width / originalSize;
        ctx.arc(x * scale, y * scale, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (planeMesh.material.map) planeMesh.material.map.needsUpdate = true;
      lastPoint = point;
    } else lastPoint = null;
  }

  function animate() {
    requestAnimationFrame(animate);
    draw();
  }

  animate();
  console.log("✅ JS cargado y canvas AR listo (transparente + raycaster alineado)");
});
