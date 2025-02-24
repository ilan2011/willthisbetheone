import "./style.css";
import { Renderer, Transform, Vec3, Color, Polyline, Post } from "ogl";

const vertex = /* glsl */ `
    precision highp float;
    attribute vec3 position;
    attribute vec3 next;
    attribute vec3 prev;
    attribute vec2 uv;
    attribute float side;
    uniform vec2 uResolution;
    uniform float uDPR;
    uniform float uThickness;
    vec4 getPosition() {
        vec4 current = vec4(position, 1);
        vec2 aspect = vec2(uResolution.x / uResolution.y, 1);
        vec2 nextScreen = next.xy * aspect;
        vec2 prevScreen = prev.xy * aspect;
    
        // Calculate the tangent direction
        vec2 tangent = normalize(nextScreen - prevScreen);
    
        // Rotate 90 degrees to get the normal
        vec2 normal = vec2(-tangent.y, tangent.x);
        normal /= aspect;
        // Taper the line to be fatter in the middle, and skinny at the ends using the uv.y
        normal *= mix(1.0, 0.1, pow(abs(uv.y - 0.5) * 2.0, 2.0) );
        // When the points are on top of each other, shrink the line to avoid artifacts.
        float dist = length(nextScreen - prevScreen);
        normal *= smoothstep(0.0, 0.06, dist);
        float pixelWidthRatio = 1.0 / (uResolution.y / uDPR);
        float pixelWidth = current.w* pixelWidthRatio;
        normal *= pixelWidth * uThickness;
        current.xy -= normal * side;
    
        return current;
    }
    void main() {
        gl_Position = getPosition();
    }
`;

const renderer = new Renderer({
  canvas: document.querySelector("#bg"),
});
const gl = renderer.gl;
document.body.appendChild(gl.canvas);

gl.clearColor(0.945, 0.945, 0.945, 0.1);

const scene = new Transform();

const lines = [];

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);

  // We call resize on the polylines to update their resolution uniforms
  lines.forEach((line) => line.polyline.resize());
}
window.addEventListener("resize", resize, false);

// Just a helper function to make the code neater
function random(a, b) {
  const alpha = Math.random();
  return a * (1.0 - alpha) + b * alpha;
}

// If you're interested in learning about drawing lines with geometry,
// go through this detailed article by Matt DesLauriers
// https://mattdesl.svbtle.com/drawing-lines-is-hard
// It's an excellent breakdown of the approaches and their pitfalls.

// In this example, we're making screen-space polylines. Basically it
// involves creating a geometry of vertices along a path - with two vertices
// at each point. Then in the vertex shader, we push each pair apart to
// give the line some width.

// We're going to make a number of different coloured lines for fun.
["#FD25B9", "#fff8dc", "#600D77", "#F79400", "#BF1AED"].forEach((color, i) => {
  // Store a few values for each lines' spring movement
  const line = {
    spring: random(0.02, 0.1),
    friction: random(0.7, 0.95),
    mouseVelocity: new Vec3(),
    mouseOffset: new Vec3(random(-1, 1) * 0.02),
  };

  // Create an array of Vec3s (eg [[0, 0, 0], ...])
  // Note: Only pass in one for each point on the line - the class will handle
  // the doubling of vertices for the polyline effect.
  const count = 30;
  const points = (line.points = []);
  for (let i = 0; i < count; i++) points.push(new Vec3());

  // Pass in the points, and any custom elements - for example here we've made
  // custom shaders, and accompanying uniforms.
  line.polyline = new Polyline(gl, {
    points,
    vertex,
    uniforms: {
      uColor: { value: new Color(color) },
      uThickness: { value: random(60, 120) },
    },
  });

  line.polyline.mesh.setParent(scene);

  lines.push(line);
});

// Call initial resize after creating the polylines
resize();

// Add handlers to get mouse position
const mouse = new Vec3();
if ("ontouchstart" in window) {
  window.addEventListener("touchstart", updateMouse, false);
  window.addEventListener("touchmove", updateMouse, false);
} else {
  window.addEventListener("mousemove", updateMouse, false);
}

function updateMouse(e) {
  if (e.changedTouches && e.changedTouches.length) {
    e.x = e.changedTouches[0].pageX;
    e.y = e.changedTouches[0].pageY;
  }
  if (e.x === undefined) {
    e.x = e.pageX;
    e.y = e.pageY;
  }

  // Get mouse value in -1 to 1 range, with y flipped
  mouse.set(
    (e.x / gl.renderer.width) * 2 - 1,
    (e.y / gl.renderer.height) * -2 + 1,
    0
  );
}

const tmp = new Vec3();

requestAnimationFrame(update);
function update(t) {
  requestAnimationFrame(update);

  lines.forEach((line) => {
    // Update polyline input points
    for (let i = line.points.length - 1; i >= 0; i--) {
      if (!i) {
        // For the first point, spring ease it to the mouse position
        tmp
          .copy(mouse)
          .add(line.mouseOffset)
          .sub(line.points[i])
          .multiply(line.spring);
        line.mouseVelocity.add(tmp).multiply(line.friction);
        line.points[i].add(line.mouseVelocity);
      } else {
        // The rest of the points ease to the point in front of them, making a line
        line.points[i].lerp(line.points[i - 1], 0.9);
      }
    }
    line.polyline.updateGeometry();
  });

  renderer.render({ scene });
}

// Section switching functionality
document.addEventListener('DOMContentLoaded', () => {
  const sectionBtns = document.querySelectorAll('.section-btn');
  const contentSections = document.querySelectorAll('.content-section');
  const modalOverlay = document.querySelector('.modal-overlay');
  const closeBtns = document.querySelectorAll('.close-section');

  // Function to close all sections
  const closeAllSections = () => {
    contentSections.forEach(section => {
      section.classList.remove('active');
    });
    sectionBtns.forEach(btn => {
      btn.classList.remove('active');
    });
    modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto'; // Re-enable scrolling
  };

  // Open section when button is clicked
  sectionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSection = btn.getAttribute('data-section');

      // Update active button
      sectionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show modal overlay
      modalOverlay.classList.add('active');

      // Prevent background scrolling when modal is open
      document.body.style.overflow = 'hidden';

      // Update active section
      contentSections.forEach(section => {
        if (section.id === targetSection) {
          section.classList.add('active');

          // Add entrance animation
          section.style.animation = 'fadeIn 0.3s ease-out forwards, scaleIn 0.3s ease-out forwards';
          setTimeout(() => {
            section.style.animation = '';
          }, 300);
        } else {
          section.classList.remove('active');
        }
      });
    });
  });

  // Close section when close button is clicked
  closeBtns.forEach(btn => {
    btn.addEventListener('click', closeAllSections);
  });

  // Close section when clicking outside the modal
  modalOverlay.addEventListener('click', closeAllSections);

  // Prevent clicks inside the modal from closing it
  contentSections.forEach(section => {
    section.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllSections();
    }
  });
});

// Add new animations for modal
const style = document.createElement('style');
style.textContent = `
  @keyframes scaleIn {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);
