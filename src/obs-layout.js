function placementTransform(preset, widget, video) {
  const canvas = video || { baseWidth: 1920, baseHeight: 1080 };
  const margin = 36;
  if (preset === 'fullscreen') return { positionX: 0, positionY: 0, alignment: 5, boundsType: 'OBS_BOUNDS_STRETCH', boundsWidth: canvas.baseWidth, boundsHeight: canvas.baseHeight };
  const positions = {
    'top-left': { positionX: margin, positionY: margin, alignment: 5 },
    'top-right': { positionX: canvas.baseWidth - margin, positionY: margin, alignment: 6 },
    'bottom-left': { positionX: margin, positionY: canvas.baseHeight - margin, alignment: 9 },
    'bottom-right': { positionX: canvas.baseWidth - margin, positionY: canvas.baseHeight - margin, alignment: 10 },
    center: { positionX: canvas.baseWidth / 2, positionY: canvas.baseHeight / 2, alignment: 0 }
  };
  return { ...(positions[preset] || positions.center), boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: Math.min(widget?.width || canvas.baseWidth, canvas.baseWidth), boundsHeight: Math.min(widget?.height || canvas.baseHeight, canvas.baseHeight) };
}

module.exports = { placementTransform };
