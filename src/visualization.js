const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  antialias: true
});
const container = document.getElementById('visualization');
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 5;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI;
camera.aspect = container.clientWidth / container.clientHeight;
camera.updateProjectionMatrix();
let nodes = [];
let connections = [];
const nodeTypes = {
  MAIN: 'main',
  FUNCTION: 'function',
  VARIABLE: 'variable',
  IMPORT: 'import',
  CLASS: 'class',
  OBJECT: 'object',
  ARRAY: 'array',
  KEY: 'key',
  ELEMENT: 'element'
};
function throttle(func, limit) {
  let lastFunc, lastRan;
  return function () {
    const context = this,
      args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}
const materials = {
  main: new THREE.MeshPhongMaterial({
    color: 0x1E90FF,
    emissive: 0x1E90FF,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  function: new THREE.MeshPhongMaterial({
    color: 0x32CD32,
    emissive: 0x32CD32,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  variable: new THREE.MeshPhongMaterial({
    color: 0xFF8C00,
    emissive: 0xFF8C00,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  import: new THREE.MeshPhongMaterial({
    color: 0x4B0082,
    emissive: 0x4B0082,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  class: new THREE.MeshPhongMaterial({
    color: 0xDC143C,
    emissive: 0xDC143C,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  object: new THREE.MeshPhongMaterial({
    color: 0x00A0A0,
    emissive: 0x00A0A0,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  array: new THREE.MeshPhongMaterial({
    color: 0x8A2BE2,
    emissive: 0x8A2BE2,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  key: new THREE.MeshPhongMaterial({
    color: 0xFFD700,
    emissive: 0xFFD700,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  element: new THREE.MeshPhongMaterial({
    color: 0xFF7F50,
    emissive: 0xFF7F50,
    emissiveIntensity: 0.5,
    shininess: 50
  }),
  literal: new THREE.MeshPhongMaterial({
    color: 0x32CD32,
    emissive: 0x32CD32,
    emissiveIntensity: 0.5,
    shininess: 50
  })
};
const connectionMaterial = new THREE.LineBasicMaterial({
  color: 0xFFFFFF,
  transparent: true,
  opacity: 0.4,
  linewidth: 2
});
const selectionMaterial = new THREE.MeshBasicMaterial({
  color: 0xFFD700,
  wireframe: true
});
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
let currentHoveredNode = null;
let hoveredChildren = [];
let isDragging = false;
let selectedNode = null;
const offset = new THREE.Vector3();
let repulsionRadius = 2.5;
const repulsionRange = document.getElementById('repulsionRange');
const repulsionValue = document.getElementById('repulsionValue');
let nodeBaseSize = 1;
const nodeSizeRange = document.getElementById('nodeSizeRange');
const nodeSizeValue = document.getElementById('nodeSizeValue');
repulsionRange.addEventListener('input', e => {
  repulsionRadius = parseFloat(e.target.value);
  repulsionValue.textContent = repulsionRadius.toFixed(1);
});
nodeSizeRange.addEventListener('input', e => {
  nodeBaseSize = parseFloat(e.target.value);
  nodeSizeValue.textContent = nodeBaseSize.toFixed(1);
  updateNodeSizes();
});
function createNode(name, type, position, varType = null) {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const material = materials[type].clone();
  const node = new THREE.Mesh(geometry, material);
  node.position.copy(position);
  node.userData = {
    name,
    type,
    varType,
    connections: [],
    pulsePhase: Math.random() * Math.PI * 2,
    isDragging: false,
    isHighlighted: false,
    originalMaterial: material
  };
  node.userData.onClick = () => {
    if (selectedNode) {
      selectedNode.material = materials[selectedNode.userData.type].clone();
    }
    selectedNode = node;
    node.material = selectionMaterial;
  };
  nodes.push(node);
  scene.add(node);
  return node;
}
function createConnection(startNode, endNode) {
  if (!startNode || !endNode) {
    console.error('Invalid nodes for connection:', {
      startNode,
      endNode
    });
    return;
  }
  console.log('Creating connection between:', startNode.userData.name, '->', endNode.userData.name);
  const geometry = new THREE.BufferGeometry().setFromPoints([startNode.position, endNode.position]);
  const line = new THREE.Line(geometry, connectionMaterial.clone());
  line.userData = {
    startNode,
    endNode,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.5 + Math.random()
  };
  connections.push(line);
  startNode.userData.connections.push(line);
  endNode.userData.connections.push(line);
  scene.add(line);
  console.log('Connection created successfully');
}
function applyInitialRepulsion() {
  const repulsionStrength = 0.1;
  const maxIterations = 100;
  const minMovement = 0.01;
  let iteration = 0;
  let maxMovement = Infinity;
  while (iteration < maxIterations && maxMovement > minMovement) {
    maxMovement = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const distance = nodeA.position.distanceTo(nodeB.position);
        if (distance < repulsionRadius && distance > 0) {
          const direction = nodeB.position.clone().sub(nodeA.position).normalize();
          const force = direction.multiplyScalar(repulsionStrength * (1 - distance / repulsionRadius));
          nodeA.position.sub(force);
          nodeB.position.add(force);
          maxMovement = Math.max(maxMovement, force.length());
          updateNodeConnections(nodeA);
          updateNodeConnections(nodeB);
        }
      }
    }
    iteration++;
  }
}
function parseAndVisualize(code) {
  nodes.forEach(node => scene.remove(node));
  connections.forEach(connection => scene.remove(connection));
  nodes = [];
  connections = [];
  try {
    const ast = esprima.parseModule(code, {
      range: true,
      loc: true
    });
    const mainNode = createNode('Main Thread', nodeTypes.MAIN, new THREE.Vector3(0, 0, 0));
    let functionCount = 0;
    let variableCount = 0;
    let importCount = 0;
    const importNodes = {};
    const globalScope = {};
    const importedModules = new Map();
    function processNode(node, parent, scope = {}) {
      switch (node.type) {
        case 'Program':
        case 'BlockStatement':
          const body = node.type === 'Program' ? node.body : node.body;
          const classDeclarations = body.filter(n => n.type === 'ClassDeclaration');
          const otherNodes = body.filter(n => n.type !== 'ClassDeclaration');
          classDeclarations.forEach(n => processNode(n, parent, scope));
          otherNodes.forEach(n => processNode(n, parent, scope));
          break;
        case 'ImportDeclaration':
          const importPath = node.source.value;
          if (importedModules.has(importPath)) break;
          const importNode = createNode(importPath, nodeTypes.IMPORT, getRandomPosition(5));
          importedModules.set(importPath, importNode);
          createConnection(mainNode, importNode);
          importCount++;
          node.specifiers.forEach(specifier => {
            const importedName = specifier.local.name;
            const classNode = createNode(importedName, nodeTypes.CLASS, getRandomPosition(5));
          });
          break;
        case 'CallExpression':
          if (node.callee.name === 'require') {
            importCount++;
            const importValue = node.arguments[0].value;
            if (importedModules.has(importValue)) break;
            const importNode = createNode(importValue, nodeTypes.IMPORT, getRandomPosition(5));
            createConnection(mainNode, importNode);
            break;
          } else if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && scope[node.callee.object.name] && scope[node.callee.object.name].userData.type === nodeTypes.IMPORT) {
            const funcName = node.callee.property.name;
            const funcNode = createNode(funcName, nodeTypes.FUNCTION, getRandomPosition(5));
            createConnection(scope[node.callee.object.name], funcNode);
            const parent = scope.function || mainNode;
            createConnection(parent, funcNode);
            break;
          }
          if (node.callee.type === 'Identifier' && scope[node.callee.name] && scope[node.callee.name].userData.type === 'class') {
            console.log('Creating instance of class:', node.callee.name);
            const instanceNode = createNode(`new ${node.callee.name}`, nodeTypes.VARIABLE, getRandomPosition(5), `Instance of ${node.callee.name}`);
            console.log('Attempting to connect class to instance:', scope[node.callee.name].userData.name, '->', instanceNode.userData.name);
            createConnection(scope[node.callee.name], instanceNode);
            const parent = scope.function || mainNode;
            createConnection(parent, instanceNode);
            break;
          }
          if (node.callee.type === 'Identifier' && scope[node.callee.name]) {
            const funcNode = scope[node.callee.name];
            const callNode = createNode(`Call: ${node.callee.name}`, nodeTypes.FUNCTION, getRandomPosition(5));
            createConnection(funcNode, callNode);
            createConnection(parent, callNode);
            break;
          }
          if (node.type === 'VariableDeclaration') {
            node.declarations.forEach(decl => {
              if (decl.init && decl.init.type === 'NewExpression' && scope[decl.init.callee.name]) {
                const varNode = createNode(`Name: ${decl.id.name}`, nodeTypes.VARIABLE, getRandomPosition(5), `Instance of ${decl.init.callee.name}`);
                createConnection(scope[decl.init.callee.name], varNode);
                const parent = scope.function || mainNode;
                createConnection(parent, varNode);
              }
            });
          }
          break;
        case 'FunctionDeclaration':
        case 'ArrowFunctionExpression':
          functionCount++;
          const funcName = node.id ? node.id.name : 'Anonymous Function';
          const funcNode = createNode(funcName, nodeTypes.FUNCTION, getRandomPosition(8));
          createConnection(mainNode, funcNode);
          const functionScope = {
            ...scope,
            function: funcNode
          };
          if (node.params) {
            node.params.forEach(param => {
              if (param.type === 'Identifier') {
                const paramNode = createNode(`Param: ${param.name}`, nodeTypes.VARIABLE, getRandomPosition(5));
                createConnection(funcNode, paramNode);
                functionScope[param.name] = paramNode;
              }
            });
          }
          if (node.body && node.body.body) {
            node.body.body.forEach(n => {
              if (n.type === 'Identifier' && scope[n.name]) {
                createConnection(funcNode, scope[n.name]);
              }
              processNode(n, funcNode, functionScope);
            });
          }
          break;
        case 'ArrayExpression':
          const varName = node.id.name;
          const varNode = createNode(`Name: ${varName}<br>Type: Array`, nodeTypes.ARRAY, getRandomPosition(5), 'Array');
          const parentNode = scope.function || mainNode;
          createConnection(parentNode, varNode);
          scope[varName] = varNode;
          processArrayElements(node.elements, varNode, scope);
          return;
        case 'VariableDeclaration':
          node.declarations.forEach(decl => {
            variableCount++;
            if (decl.init && decl.init.type === 'ObjectExpression') {
              const varName = decl.id.name;
              const varNode = createNode(`Name: ${varName}<br>Type: Dictionary`, nodeTypes.OBJECT, getRandomPosition(5), 'Dictionary');
              const parentNode = scope.function || mainNode;
              createConnection(parentNode, varNode);
              scope[varName] = varNode;
              processObjectProperties(decl.init.properties, varNode, scope);
              return;
            }
            if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee.name === 'require') {
              const moduleName = decl.init.arguments[0].value;
              let importNode = importedModules.get(moduleName);
              console.log(importNode);
              if (!importNode) {
                importNode = createNode(moduleName, nodeTypes.IMPORT, getRandomPosition(5));
                createConnection(mainNode, importNode);
                importedModules.set(moduleName, importNode);
                importCount++;
              }
              if (decl.id.type === 'ObjectPattern') {
                decl.id.properties.forEach(prop => {
                  const importedName = prop.value.name;
                  const classNode = createNode(importedName, nodeTypes.CLASS, getRandomPosition(5));
                  createConnection(importNode, classNode);
                  scope[importedName] = classNode;
                });
              } else if (decl.id.type === 'Identifier') {
                const importedName = decl.id.name;
                const classNode = createNode(importedName, nodeTypes.CLASS, getRandomPosition(5));
                createConnection(importNode, classNode);
                scope[importedName] = classNode;
              }
              return;
            }
            let varName,
              varValue = 'undefined',
              varType = 'unknown';
            if (decl.id.type === 'Identifier') {
              varName = decl.id.name;
            } else {
              console.warn(`Unsupported declaration type: ${decl.id.type}`);
              return;
            }
            if (decl.init) {
              if (decl.init.type === 'NewExpression') {
                const className = decl.init.callee.name;
                if (scope[className]) {
                  const instanceNode = createNode(`Name: ${decl.id.name}<br>Value: new ${className}(...)`, nodeTypes.VARIABLE, getRandomPosition(5), `Instance of ${className}`);
                  createConnection(scope[className], instanceNode);
                  const parentNode = scope.function || mainNode;
                  createConnection(parentNode, instanceNode);
                  scope[decl.id.name] = instanceNode;
                  return;
                } else {
                  console.error(`Class not found in scope: ${className}`);
                }
              } else if (decl.init.type === 'Literal') {
                varType = typeof decl.init.value;
                varValue = JSON.stringify(decl.init.value);
              } else {
                varType = decl.init.type;
              }
            }
            const varNode = createNode(`Name: ${decl.id.name}<br>Value: ${varValue}`, nodeTypes.VARIABLE, getRandomPosition(12), varType);
            const parent = scope.function || mainNode;
            createConnection(parent, varNode);
            scope[decl.id.name] = varNode;
          });
          break;
        case 'ClassDeclaration':
          const className = node.id.name;
          const classNode = createNode(className, nodeTypes.CLASS, getRandomPosition(8));
          createConnection(mainNode, classNode);
          scope[className] = classNode;
          if (node.body && node.body.body) {
            node.body.body.forEach(n => {
              if (n.type === 'MethodDefinition') {
                const methodNode = createNode(n.key.name, nodeTypes.FUNCTION, getRandomPosition(5));
                createConnection(classNode, methodNode);
              }
            });
          }
          break;
        case 'Identifier':
          if (scope[node.name] && scope.function) {
            createConnection(scope.function, scope[node.name]);
          }
          break;
      }
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => {
              if (child && typeof child === 'object') {
                processNode(child, parent, scope);
              }
            });
          } else {
            processNode(node[key], parent, scope);
          }
        }
      }
    }
    ast.body.forEach(node => processNode(node, mainNode, globalScope));
    applyInitialRepulsion();
    document.getElementById('functionCount').textContent = functionCount;
    document.getElementById('variableCount').textContent = variableCount;
    document.getElementById('importCount').textContent = importCount;
  } catch (error) {
    console.error('Error parsing code:', error);
  }
}
function getRandomPosition(radius, minDistance = 2) {
  let position;
  let attempts = 0;
  const maxAttempts = 100;
  do {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    position = new THREE.Vector3(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
    let isValid = true;
    for (const node of nodes) {
      if (position.distanceTo(node.position) < minDistance) {
        isValid = false;
        break;
      }
    }
    if (isValid) {
      return position;
    }
    attempts++;
  } while (attempts < maxAttempts);
  console.warn('Could not find a valid position after', maxAttempts, 'attempts. Returning last position.');
  return position;
}
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;
const tooltip = document.getElementById('nodeTooltip');
let tooltipVisible = false;
function updateTooltip(node) {
  let content = node.userData.name;
  if (node.userData.type === 'variable') {
    content += `<div class="tooltip-detail">Type: ${node.userData.varType || 'unknown'}</div>`;
  }
  content += `<div class="tooltip-type">${node.userData.type}</div>`;
  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
}
function onMouseDown(event) {
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodes);
  if (intersects.length > 0) {
    selectedNode = intersects[0].object;
    offset.copy(selectedNode.position).sub(intersects[0].point);
    isDragging = true;
    controls.enabled = false;
  }
}
function onMouseMove(event) {
  if (isDragging && selectedNode) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    selectedNode.position.copy(intersection.add(offset));
    updateNodeConnections(selectedNode);
  }
}
function onMouseUp() {
  if (isDragging) {
    isDragging = false;
    selectedNode = null;
    controls.enabled = true;
    tooltip.style.display = 'none';
  }
}
let lastUpdateTime = 0;
const updateInterval = 100;
let composer;
function initComposer() {
  if (!THREE.EffectComposer) return;
  const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.6, 0.4);
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  composer.addPass(bloomPass);
}
initComposer();
function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();
  const time = now * 0.001;
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  if (!isDragging || now - lastUpdateTime > updateInterval) {
    const repulsionStrength = 0.05;
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        const distance = nodeA.position.distanceTo(nodeB.position);
        if (distance < repulsionRadius && distance > 0) {
          const direction = nodeB.position.clone().sub(nodeA.position).normalize();
          const force = direction.multiplyScalar(repulsionStrength * (1 - distance / repulsionRadius));
          nodeA.position.sub(force);
          nodeB.position.add(force);
          if (!isDragging) {
            updateNodeConnections(nodeA);
            updateNodeConnections(nodeB);
          }
        }
      }
    }
    lastUpdateTime = now;
  }
  nodes.forEach(node => {
    if (node === hoveredNode) {
      node.scale.set(nodeBaseSize * 1.5, nodeBaseSize * 1.5, nodeBaseSize * 1.5);
    } else {
      const scale = nodeBaseSize + 0.1 * Math.sin(time * 2 + node.userData.pulsePhase);
      node.scale.set(scale, scale, scale);
    }
  });
  connections.forEach(connection => {
    const pulse = Math.sin(time * connection.userData.pulseSpeed + connection.userData.pulsePhase);
    connection.material.opacity = 0.2 + 0.4 * Math.abs(pulse);
  });
  nodes.forEach(node => {
    if (node.userData.highlightLight) {
      node.userData.highlightLight.position.copy(node.position);
    }
  });
  controls.update();
}
function updateNodeConnections(node) {
  const position = node.position;
  node.userData.connections.forEach(connection => {
    const geometry = connection.geometry;
    if (connection.userData.startNode === node) {
      geometry.setFromPoints([position, connection.userData.endNode.position]);
    } else if (connection.userData.endNode === node) {
      geometry.setFromPoints([connection.userData.startNode.position, position]);
    }
    geometry.attributes.position.needsUpdate = true;
  });
}
function updateNodeSizes() {
  nodes.forEach(node => {
    const scale = node === hoveredNode ? nodeBaseSize * 1.5 : nodeBaseSize;
    node.scale.set(scale, scale, scale);
  });
}
const optimizedMouseMove = throttle(event => {
  var _intersects$;
  if (isDragging) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodes);
  const newHoveredNode = (_intersects$ = intersects[0]) === null || _intersects$ === void 0 ? void 0 : _intersects$.object;
  if (newHoveredNode) {
    tooltip.style.left = `${event.clientX + 15}px`;
    tooltip.style.top = `${event.clientY + 15}px`;
    updateTooltip(newHoveredNode);
  } else {
    tooltip.style.display = 'none';
  }
  if (newHoveredNode !== currentHoveredNode) {
    if (currentHoveredNode) {
      highlightNode(currentHoveredNode, false);
      hoveredChildren.forEach(child => highlightNode(child, false));
      hoveredChildren = [];
    }
    if (newHoveredNode) {
      highlightNode(newHoveredNode, true);
      hoveredChildren = newHoveredNode.userData.connections.map(conn => conn.userData.endNode).filter(node => node !== newHoveredNode);
      hoveredChildren.forEach(child => highlightNode(child, true));
    }
    currentHoveredNode = newHoveredNode;
  }
}, 50);
window.addEventListener('resize', () => {
  const container = document.getElementById('visualization');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  if (composer) {
    composer.setSize(container.clientWidth, container.clientHeight);
  }
});
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('mousemove', optimizedMouseMove);
document.getElementById('analyze-btn').addEventListener('click', () => {
  const code = document.getElementById('code-input').value;
  parseAndVisualize(code);
});
camera.position.z = 20;
animate();
const codeInput = document.getElementById('code-input');
const codeHighlight = document.querySelector('#code-highlight code');
const highlightContainer = document.getElementById('code-highlight');
codeInput.addEventListener('input', () => {
  const code = codeInput.value;
  codeHighlight.textContent = code;
  Prism.highlightElement(codeHighlight);
});
codeInput.addEventListener('scroll', () => {
  highlightContainer.scrollTop = codeInput.scrollTop;
  highlightContainer.scrollLeft = codeInput.scrollLeft;
});
const resizeHandle = document.querySelector('.resize-handle');
const codePanel = document.getElementById('code-panel');
let isResizing = false;
resizeHandle.addEventListener('mousedown', e => {
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove);
  });
});
function handleMouseMove(e) {
  if (!isResizing) return;
  e.preventDefault();
  const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth * 0.8));
  codePanel.style.width = newWidth + 'px';
  renderer.setSize(container.clientWidth, container.clientHeight);
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
}
function processObjectProperties(properties, parentNode, scope) {
  properties.forEach(prop => {
    const key = prop.key.name || prop.key.value;
    const isArray = prop.value.type === "ArrayExpression";
    let type = prop.value.type;
    if (type === 'ArrayExpression') type = "Array";else if (type === 'ObjectExpression') type = "Dictionary";else if (type === 'Literal') type = parseType(prop.value.raw);
    const valueNode = createNode(`Key: ${key}<br>Value: ${prop.value.raw}<br><br>Type: ${type}`, isArray ? nodeTypes.ARRAY : nodeTypes.KEY, getRandomPosition(5), 'Property');
    createConnection(parentNode, valueNode);
    if (prop.value.type === 'ObjectExpression') {
      processObjectProperties(prop.value.properties, valueNode, scope);
    } else if (prop.value.type === 'ArrayExpression') {
      processArrayElements(prop.value.elements, valueNode, scope);
    }
  });
}
function parseType(raw) {
  if (raw === 'null') return 'Null';else if (raw === 'undefined') return 'Undefined';else if (raw === 'true') return 'Boolean';else if (raw === 'false') return 'Boolean';else if (raw === 'NaN') return 'Number';else if (raw === 'Infinity') return 'Number';else if (raw === '-Infinity') return 'Number';else if (raw.startsWith('"') && raw.endsWith('"')) return 'String';else if (raw.startsWith("'") && raw.endsWith("'")) return 'String';else if (raw.startsWith("`") && raw.endsWith("`")) return 'String';else if (!isNaN(parseInt(raw))) return 'Number';else if (!isNaN(parseFloat(raw))) return 'Number';else return 'Unknown';
}
function processArrayElements(elements, parentNode, scope) {
  elements.forEach((element, index) => {
    let type = element.type;
    if (type === 'ArrayExpression') type = "Array";else if (type === 'ObjectExpression') type = "Dictionary";else if (type === 'Literal') type = parseType(element.raw);
    const elementNode = createNode(`Index: ${index}<br>Value: ${element.raw}<br><br>Type: ${type}`, nodeTypes.ELEMENT, getRandomPosition(5), 'Element');
    createConnection(parentNode, elementNode);
    if (element.type === 'ObjectExpression') {
      processObjectProperties(element.properties, elementNode, scope);
    } else if (element.type === 'ArrayExpression') {
      processArrayElements(element.elements, elementNode, scope);
    }
  });
}
const highlightMaterial = new THREE.MeshStandardMaterial({
  color: 0xFFD700,
  emissive: 0xFFD700,
  emissiveIntensity: 1,
  metalness: 0.5,
  roughness: 0.1
});
function highlightNode(node, highlight) {
  if (!node) return;
  const targetIntensity = highlight ? 2.0 : 0.5;
  node.material.emissiveIntensity = targetIntensity;
  node.material.needsUpdate = true;
}