AFRAME.registerComponent("mxr-interactor", {
  schema: {
    targetClass: { type: "string", default: ".interactable" },
    interactPose: { type: "string", default: "pinch" }
  },

  init() {
    this.onInteract = this.onInteract.bind(this);
    this.el.addEventListener(`mxr-${this.data.interactPose}-start`, this.onInteract);
  },

  remove() {
    this.el.removeEventListener(`mxr-${this.data.interactPose}-start`, this.onInteract);
  },

  onInteract() {
    if (!MXRInteractionManager.request("interact", this)) return;

    const cursorComponent = this.el.components["mxr-cursor"];
    if (cursorComponent) {
      const hovered = cursorComponent.getHoveredElement();
      
      if (hovered && hovered.matches(this.data.targetClass)) {
        
        // a bolinha é preenchida simultaneamente ao clique
        cursorComponent.setCursorActive(true);
        hovered.emit("click");
        
        const currentScale = hovered.getAttribute("scale") || {x: 1, y: 1, z: 1};
        hovered.setAttribute("scale", {
          x: currentScale.x * 0.9, 
          y: currentScale.y * 0.9, 
          z: currentScale.z * 0.9
        });
        
        setTimeout(() => {
          hovered.setAttribute("scale", currentScale);
          // a bolinha regressa ao anel assim que o pulso termina
          if (this.el.components["mxr-cursor"]) {
            this.el.components["mxr-cursor"].setCursorActive(false);
          }
        }, 150);
      }
    }

    MXRInteractionManager.release(this);
  }
});