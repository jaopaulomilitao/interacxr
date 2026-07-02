#!/bin/bash

output_file="project_review.md"

if [ -f "$output_file" ]; then
    rm "$output_file"
fi

# A estrutura estática inicial é escrita
cat << 'EOF' >> "$output_file"
# InteracXR: WebXR Hand Tracking & Interaction Engine

## 1. Project Objective
Develop a high-performance, low-cost WebXR hand-tracking library for mobile devices using MediaPipe and A-Frame. The focus is to democratize immersive virtual reality (VR) interactions, such as spatial manipulation and locomotion, without the need for expensive dedicated headsets (e.g., Meta Quest).

## 2. Progress Tracker

### 2.1. What Has Been Done
* Implementation of the core hand-tracking engine via Web Workers (`mxr-hand-tracking.js`).
* Creation of a robust Gesture State Machine (`mxr-gesture-detector.js`) identifying: Point, Grab, Pinch, Rock, and Gun.
* Integration of mathematical Jitter reduction (Hysteresis) and state exclusivity.
* Development of a parabolic locomotion system (`mxr-teleport.js`) using kinematic physics and Difference Blending.
* Implementation of a long-distance object manipulation system (`mxr-laser-grabber.js`) using Raycasting.
* Isolation of the VR environment to ensure stable 60 FPS on mobile hardware.

### 2.2. What Needs To Be Done
* Integrate 3D hand models to replace the wireframe/laser visualizer.
* Fine-tune the physics and colliders for the grabbed objects.
* Write the academic article mapping the architecture.

---

## 3. Academic Article Structure

1. **Introduction:** Context of low-cost VR/AR, WebXR accessibility, and current hardware limitations.
2. **Related Works:** Analysis of frameworks (A-Frame, Three.js) and ML models (MediaPipe).
3. **Proposed Architecture:** Modular component system and Web Worker ML offloading.
4. **Interaction Paradigms:** Spatial Locomotion (Parabolic) and Remote Manipulation (Laser).
5. **Performance & UX:** FPS metrics, optical tracking noise mitigation, and gesture usability.
6. **Conclusion:** MVP success summary and roadmap for future OS-level AR integrations.

---

## 4. Directory Structure

EOF

# A árvore do projeto é desenhada de forma segura
printf '```text\n' >> "$output_file"
find . -not -path '*/\.*' | sort | sed 's/[^/]*\//  /g' >> "$output_file"
printf '```\n\n---\n\n' >> "$output_file"

printf "## 5. Codebase Files\n\n" >> "$output_file"

scan_dirs=("src" "examples")

for dir in "${scan_dirs[@]}"; do
    if [ -d "$dir" ]; then
        find "$dir" -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) | sort | while read -r file; do
            
            extension="${file##*.}"
            syntax="text"
            
            if [ "$extension" = "js" ]; then
                syntax="javascript"
            elif [ "$extension" = "html" ]; then
                syntax="html"
            elif [ "$extension" = "css" ]; then
                syntax="css"
            fi

            # O printf evita o bug de execução de backticks do bash
            printf "### File: %s\n\n" "$file" >> "$output_file"
            printf '```%s\n' "$syntax" >> "$output_file"
            cat "$file" >> "$output_file"
            printf '\n```\n\n---\n\n' >> "$output_file"
            
        done
    fi
done

echo "Documentation generated successfully in $output_file!"