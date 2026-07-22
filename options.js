document.addEventListener('DOMContentLoaded', () => {
    const fnName = document.getElementById('fnName');
    const fnArity = document.getElementById('fnArity');
    const fnReturnType = document.getElementById('fnReturnType');
    const fnJs = document.getElementById('fnJs');
    const fnGlsl = document.getElementById('fnGlsl');
    const sharedJS = document.getElementById('sharedJS');
    const sharedGLSL = document.getElementById('sharedGLSL');
    const addBtn = document.getElementById('addBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveLibsBtn = document.getElementById('saveLibsBtn');
    const fnList = document.getElementById('fnList');
    const nameLabel = document.getElementById('nameLabel');
    const argTypesContainer = document.getElementById('argTypesContainer');
    const derivativesContainer = document.getElementById('derivativesContainer');
    const formStatus = document.getElementById('formStatus');
    const libsStatus = document.getElementById('libsStatus');

    let isEditing = false;
    let editingIndex = -1;

    const initialSharedJS = ``;

    const initialSharedGLSL = ``;

    const initialFunctions = [
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x);\nif (x < 2) return 0;\nif (x === 2 || x === 3) return 1;\nif (x % 2 === 0 || x % 3 === 0) return 0;\n\nfor (let i = 5; i * i <= x; i += 6) {\n    if (x % i === 0 || x % (i + 2) === 0) return 0;\n}\nreturn 1;",
        "name": "isprime",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x);\nif (x < 2) return 0;\nif (x > 2000000000) return NaN;\n\nconst r = Math.floor(Math.sqrt(x));\n\nconst S_lo = new Int32Array(r + 1);\nconst S_hi = new Int32Array(r + 1);\n\nfor (let i = 1; i <= r; i++) {\n    S_lo[i] = i - 1;\n    S_hi[i] = Math.floor(x / i) - 1;\n}\n\nfor (let p = 2; p <= r; p++) {\n    if (S_lo[p] === S_lo[p - 1]) continue;\n    \n    const pc = S_lo[p - 1];\n    const p2 = p * p;\n    \n    const max_i = Math.min(r, Math.floor(x / p2));\n    \n    for (let i = 1; i <= max_i; i++) {\n        const d = i * p;\n        S_hi[i] -= (d <= r ? S_hi[d] : S_lo[Math.floor(x / d)]) - pc;\n    }\n    \n    for (let i = r; i >= p2; i--) {\n        S_lo[i] -= S_lo[Math.floor(i / p)] - pc;\n    }\n}\n\nreturn S_hi[1];",
        "name": "primecount",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x);\nif (x < 1 || x > 50000000) return NaN;\nif (x === 1) return 2;\n\nlet low, high;\nif (x < 6) {\n    low = 2;\n    high = 15;\n} else {\n    const l = Math.log(x);\n    const ll = Math.log(l);\n    low = Math.floor(x * l);\n    high = Math.floor(x * (l + ll * 1.5));\n}\n\nfunction count(n) {\n    const r = Math.floor(Math.sqrt(n));\n    const S_lo = new Int32Array(r + 1);\n    const S_hi = new Int32Array(r + 1);\n    \n    for (let i = 1; i <= r; i++) {\n        S_lo[i] = i - 1;\n        S_hi[i] = Math.floor(n / i) - 1;\n    }\n    \n    for (let p = 2; p <= r; p++) {\n        if (S_lo[p] === S_lo[p - 1]) continue;\n        const pc = S_lo[p - 1];\n        const p2 = p * p;\n        const max_i = Math.min(r, Math.floor(n / p2));\n        \n        for (let i = 1; i <= max_i; i++) {\n            const d = i * p;\n            S_hi[i] -= (d <= r ? S_hi[d] : S_lo[Math.floor(n / d)]) - pc;\n        }\n        for (let i = r; i >= p2; i--) {\n            S_lo[i] -= S_lo[Math.floor(i / p)] - pc;\n        }\n    }\n    return S_hi[1];\n}\n\nwhile (low < high) {\n    let mid = (low + high) >>> 1;\n    if (count(mid) < x) low = mid + 1;\n    else high = mid;\n}\n\nreturn low;",
        "name": "nthprime",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "if (x < 1 || !Number.isFinite(x)) return NaN;\nif (x === 1) return 1.0;\n\nconst p = [\n    0.99999999999980993, 676.5203681218851, -1259.1392167224028,\n    771.32342877765313, -176.61502916214059, 12.507343278686905,\n    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7\n];\nconst g = 7;\nconst targetLn = Math.log(x);\n\nlet low = 1.0;\nlet high = 18.0; \n\nwhile (true) {\n    let z = high + 1.0;\n    let sum = p[0];\n    for (let i = 1; i < g + 2; i++) sum += p[i] / (z + i - 1);\n    let lnGamma = Math.log(Math.sqrt(2 * Math.PI)) + (z - 0.5) * Math.log(z + g - 0.5) - (z + g - 0.5) + Math.log(sum);\n    if (lnGamma >= targetLn) break;\n    high *= 2.0;\n}\n\nfor (let iter = 0; iter < 50; iter++) {\n    const mid = (low + high) / 2.0;\n    const z = mid + 1.0;\n    \n    let sum = p[0];\n    for (let i = 1; i < g + 2; i++) {\n        sum += p[i] / (z + i - 1);\n    }\n    const t = z + g - 0.5;\n    const lnGamma = Math.log(Math.sqrt(2 * Math.PI)) + (z - 0.5) * Math.log(t) - t + Math.log(sum);\n    \n    if (lnGamma < targetLn) {\n        low = mid;\n    } else {\n        high = mid;\n    }\n}\n\nconst result = (low + high) / 2.0;\n\nreturn Math.abs(result - Math.round(result)) < 1e-11 ? Math.round(result) : result;",
        "name": "invfactorial",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            "x_1 * \\\\frac{q}{x(1+q)}"
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "if (x < -0.36787944117144233 || !Number.isFinite(x)) return NaN;\n\nlet w;\n\nif (x < -0.3) {\n    const p = Math.sqrt(2.0 * (Math.E * x + 1.0));\n    w = -1.0 + p - (1.0 / 3.0) * p * p + (11.0 / 72.0) * p * p * p;\n} else if (x < 5.0) {\n    w = x / (1.0 + x * (1.0 + x / 3.0) / (1.0 + x * 5.0 / 6.0));\n} else {\n    const lnx = Math.log(x);\n    const lnlnx = Math.log(lnx);\n    w = lnx - lnlnx + lnlnx / lnx;\n}\n\nfor (let i = 0; i < 4; i++) {\n    if (w > 500.0) {\n        const lnW = Math.log(w);\n        const error = lnW + w - Math.log(x);\n        const deriv = 1.0 + 1.0 / w;\n        w -= error / deriv;\n    } else {\n        const ew = Math.exp(w);\n        const f = w * ew - x;\n        const numerator = f;\n        const denominator = ew * (w + 1.0) - ((w + 2.0) * f) / (2.0 * w + 2.0);\n        w -= numerator / denominator;\n    }\n}\n\nreturn w;",
        "name": "lambertw",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x) + 1;\nif (x <= 2) return 2;\nif (x % 2 === 0) x++;\n\nwhile (true) {\n    let isP = true;\n    if (x % 3 === 0) {\n        if (x > 3) isP = false;\n    } else {\n        for (let i = 5; i * i <= x; i += 6) {\n            if (x % i === 0 || x % (i + 2) === 0) { \n                isP = false; \n                break; \n            }\n        }\n    }\n    if (isP) return x;\n    x += 2;\n}",
        "name": "nextprime",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "L"
        ],
        "jsBody": "const [r, i] = x;\n\nif (i === 0 && Number.isInteger(r)) {\n  const fibInt = (n) => {\n    if (n === 0) return 0;\n    let a = 0, b = 1;\n    for (let k = 2; k <= Math.abs(n); k++) {\n      const next = a + b;\n      a = b;\n      b = next;\n    }\n    return n < 0 && n % 2 === 0 ? -b : b;\n  };\n  return [fibInt(r), 0];\n}\n\nconst sqrt5 = Math.sqrt(5);\nconst phi = (1 + sqrt5) / 2;\nconst lnPhi = Math.log(phi);\n\nconst mag1 = Math.pow(phi, r);\nconst arg1 = i * lnPhi;\nconst phiZ_r = mag1 * Math.cos(arg1);\nconst phiZ_i = mag1 * Math.sin(arg1);\n\nconst lnPsi_r = -lnPhi;\nconst lnPsi_i = Math.PI;\nconst realPower = r * lnPsi_r - i * lnPsi_i;\nconst imagPower = r * lnPsi_i + i * lnPsi_r;\nconst mag2 = Math.exp(realPower);\nconst psiZ_r = mag2 * Math.cos(imagPower);\nconst psiZ_i = mag2 * Math.sin(imagPower);\n\nreturn [\n  (phiZ_r - psiZ_r) / sqrt5,\n  (phiZ_i - psiZ_i) / sqrt5\n];",
        "name": "fib",
        "returnType": "L"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "if (x <= 0) return [];\n\nconst sequence = new Array(x);\nconst visited = new Set();\n\nsequence[0] = 0;\nvisited.add(0);\n\nfor (let i = 1; i < x; i++) {\n    const previous = sequence[i - 1];\n    const backward = previous - i;\n    \n    if (backward > 0 && !visited.has(backward)) {\n        sequence[i] = backward;\n        visited.add(backward);\n    } else {\n        const forward = previous + i;\n        sequence[i] = forward;\n        visited.add(forward);\n    }\n}\n\nreturn sequence;",
        "name": "recaman",
        "returnType": "me"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "const path = [[0, x]];\nlet step = 0;\n\nwhile (x > 1) {\n    x = x % 2 === 0 ? x / 2 : 3 * x + 1;\n    step++;\n    path.push([step, x]);\n}\n\nreturn path;",
        "name": "collatz",
        "returnType": "_r"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x);\nif (x < 2 || !Number.isFinite(x)) return [];\n\nconst factors = [];\n\nwhile (x % 2 === 0) {\n    factors.push(2);\n    x /= 2;\n}\n\nwhile (x % 3 === 0) {\n    factors.push(3);\n    x /= 3;\n}\n\nfor (let i = 5; i * i <= x; i += 6) {\n    while (x % i === 0) {\n        factors.push(i);\n        x /= i;\n    }\n    while (x % (i + 2) === 0) {\n        factors.push(i + 2);\n        x /= (i + 2);\n    }\n}\n\nif (x > 1) {\n    factors.push(x);\n}\n\nreturn factors;",
        "name": "primefactors",
        "returnType": "me"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "I"
        ],
        "jsBody": "x = Math.floor(x);\nif (x < 1 || !Number.isFinite(x)) return 0;\nif (x === 1) return 1;\n\nlet result = x;\n\nif (x % 2 === 0) {\n    while (x % 2 === 0) x /= 2;\n    result -= result / 2;\n}\nif (x % 3 === 0) {\n    while (x % 3 === 0) x /= 3;\n    result -= result / 3;\n}\n\nfor (let i = 5; i * i <= x; i += 6) {\n    if (x % i === 0) {\n        while (x % i === 0) x /= i;\n        result -= result / i;\n    }\n    if (x % (i + 2) === 0) {\n        while (x % (i + 2) === 0) x /= (i + 2);\n        result -= result / (i + 2);\n    }\n}\n\nif (x > 1) result -= result / x;\n\nreturn result;",
        "name": "totient",
        "returnType": "I"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "L"
        ],
        "jsBody": "return x",
        "name": "topoint",
        "returnType": "O"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "me"
        ],
        "jsBody": "return x.toReversed()",
        "name": "reverse",
        "returnType": "me"
    },
    {
        "arity": 2,
        "derivatives": [
            "",
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "me",
            "I"
        ],
        "jsBody": "const indices = [];\nconst len = x.length;\n\nfor (let i = 0; i < len; i++) {\n    if (x[i] === y) {\n        indices.push(i+1);\n    }\n}\nreturn indices;",
        "name": "find",
        "returnType": "me"
    },
    {
        "arity": 2,
        "derivatives": [
            "",
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "St",
            "I"
        ],
        "jsBody": "const N = Math.pow(2, y);\nconst L = x.length;\nlet densePoints;\n\nif (L < 2) {\n  densePoints = new Array(N).fill(0).map(() => (L === 1 ? [x[0][0], x[0][1]] : [0, 0]));\n} else {\n  const segLengths = new Float64Array(L);\n  const cumulativeDist = new Float64Array(L + 1);\n  let perimeter = 0;\n\n  for (let i = 0; i < L; i++) {\n    const p1 = x[i], p2 = x[(i + 1) % L];\n    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];\n    const len = Math.sqrt(dx * dx + dy * dy);\n    segLengths[i] = len;\n    perimeter += len;\n    cumulativeDist[i + 1] = perimeter;\n  }\n\n  densePoints = new Array(N);\n  let segIdx = 0;\n\n  for (let i = 0; i < N; i++) {\n    const targetDist = (i / N) * perimeter;\n    while (segIdx < L - 1 && cumulativeDist[segIdx + 1] < targetDist) {\n      segIdx++;\n    }\n    const p1 = x[segIdx], p2 = x[(segIdx + 1) % L];\n    const distInSeg = targetDist - cumulativeDist[segIdx];\n    const segLen = segLengths[segIdx];\n\n    if (segLen === 0) {\n      densePoints[i] = [p1[0], p1[1]];\n    } else {\n      const t = distInSeg / segLen;\n      densePoints[i] = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];\n    }\n  }\n}\n\nconst re = new Float64Array(N);\nconst im = new Float64Array(N);\n\nfor (let i = 0; i < N; i++) {\n  re[i] = densePoints[i][0];\n  im[i] = densePoints[i][1];\n}\n\nlet j = 0;\nfor (let i = 0; i < N; i++) {\n  if (i < j) {\n    let tempRe = re[i], tempIm = im[i];\n    re[i] = re[j];\n    im[i] = im[j];\n    re[j] = tempRe;\n    im[j] = tempIm;\n  }\n  let bit = N >> 1;\n  while (bit <= j && bit > 0) {\n    j -= bit;\n    bit >>= 1;\n  }\n  j += bit;\n}\n\nfor (let len = 2; len <= N; len <<= 1) {\n  const angle = (-2 * Math.PI) / len;\n  const wlenRe = Math.cos(angle), wlenIm = Math.sin(angle);\n\n  for (let i = 0; i < N; i += len) {\n    let wRe = 1.0, wIm = 0.0;\n    const halfLen = len >> 1;\n\n    for (let k = 0; k < halfLen; k++) {\n      const uIdx = i + k, vIdx = i + k + halfLen;\n      const tRe = re[vIdx] * wRe - im[vIdx] * wIm;\n      const tIm = re[vIdx] * wIm + im[vIdx] * wRe;\n\n      re[vIdx] = re[uIdx] - tRe;\n      im[vIdx] = im[uIdx] - tIm;\n      re[uIdx] += tRe;\n      im[uIdx] += tIm;\n\n      const nextWRe = wRe * wlenRe - wIm * wlenIm;\n      wIm = wRe * wlenIm + wIm * wlenRe;\n      wRe = nextWRe;\n    }\n  }\n}\n\nconst fourier = new Array(N);\nfor (let k = 0; k < N; k++) {\n  let freq = k;\n  if (freq > N / 2) freq -= N;\n  fourier[k] = {\n    freq: freq,\n    amp: Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N,\n    phase: Math.atan2(im[k], re[k])\n  };\n}\n\nfourier.sort((a, b) => {\n  const absA = Math.abs(a.freq);\n  const absB = Math.abs(b.freq);\n  if (absA !== absB) return absA - absB;\n  return b.freq - a.freq;\n});\n\nconst coefficientsAsPoints = new Array(N);\nfor (let i = 0; i < N; i++) {\n  const p = fourier[i];\n  coefficientsAsPoints[i] = [\n    p.amp * Math.cos(p.phase),\n    p.amp * Math.sin(p.phase)\n  ];\n}\n\nreturn coefficientsAsPoints;",
        "name": "fouriercoeffs",
        "returnType": "St"
    },
    {
        "arity": 1,
        "derivatives": [
            ""
        ],
        "enabled": true,
        "glslBody": "",
        "inputTypes": [
            "me"
        ],
        "jsBody": "const len = x.length;\nif (len === 0) return [];\nconst result = new Array(len);\nresult[0] = x[0];\nfor (let i = 1; i < len; i++) {\n  result[i] = result[i - 1] + x[i];\n}\nreturn result;",
        "name": "prefsum",
        "returnType": "me"
    }
];

    function showStatus(element, text, isError = false) {
        if (!element) return;
        element.textContent = text;
        element.style.color = isError ? "#c74440" : "#348543";
        element.classList.add('show');
        setTimeout(() => {
            element.classList.remove('show');
        }, 3000);
    }

    function renderDynamicFormFields(arity) {
        argTypesContainer.innerHTML = '';
        derivativesContainer.innerHTML = '';
        const paramNames = ["x", "y", "z"];

        for (let i = 0; i < arity; i++) {
            const pName = paramNames[i];

            const typeGroup = document.createElement('div');
            typeGroup.className = 'form-group';
            typeGroup.style.marginBottom = '10px';
            typeGroup.innerHTML = `
                <label style="font-size:12px; font-weight:normal;" for="argType_${i}">Type for Argument ${i+1} (${pName})</label>
                <select id="argType_${i}">
                    <option value="I">Number</option>
                    <option value="L">Complex Number</option>
                    <option value="O">Point</option>
                    <option value="me">List of Numbers</option>
                    <option value="St">List of Complex Numbers</option>
                    <option value="_r">List of Points</option>
                </select>
            `;
            argTypesContainer.appendChild(typeGroup);

            const derivGroup = document.createElement('div');
            derivGroup.className = 'form-group';
            derivGroup.style.marginBottom = '10px';
            derivGroup.innerHTML = `
                <label style="font-size:12px; font-weight:normal;" for="deriv_${i}">Derivative w.r.t. ${pName} (LaTeX - x_1 = derivative of inner function, q = outer function)</label>
                <input type="text" id="deriv_${i}" placeholder="e.g. 2 * ${pName} * x_1">
            `;
            derivativesContainer.appendChild(derivGroup);
        }
    }

    function initializeAndLoad() {
        chrome.storage.local.get(['customFunctions', 'sharedJS', 'sharedGLSL'], (data) => {
            if (data.customFunctions === undefined) {
                chrome.storage.local.set({
                    customFunctions: initialFunctions,
                    sharedJS: initialSharedJS,
                    sharedGLSL: initialSharedGLSL
                }, () => {
                    sharedJS.value = initialSharedJS;
                    sharedGLSL.value = initialSharedGLSL;
                    renderDynamicFormFields(1);
                    updateList();
                });
            } else {
                sharedJS.value = data.sharedJS !== undefined ? data.sharedJS : "";
                sharedGLSL.value = data.sharedGLSL !== undefined ? data.sharedGLSL : "";
                renderDynamicFormFields(1);
                updateList();
            }
        });
    }

    function resetForm() {
        isEditing = false;
        editingIndex = -1;
        fnName.value = '';
        fnArity.value = "1";
        fnReturnType.value = "I";
        renderDynamicFormFields(1);
        fnJs.value = '';
        fnGlsl.value = '';
        nameLabel.textContent = "Function Name";
        addBtn.textContent = "Add Function";
        cancelBtn.style.display = "none";
    }

    function updateList() {
        chrome.storage.local.get('customFunctions', (data) => {
            const funcs = data.customFunctions || [];
            fnList.innerHTML = '';
            funcs.forEach((fn, index) => {
                const item = document.createElement('div');
                item.className = 'fn-item';
                
                const isFnEnabled = fn.enabled !== false;
                const toggleText = isFnEnabled ? 'Active' : 'Inactive';
                const toggleClass = isFnEnabled ? 'toggle-active' : 'toggle-inactive';

                item.innerHTML = `
                  <span class="fn-name" style="opacity: ${isFnEnabled ? '1' : '0.4'}">${fn.name}(${['x', 'y', 'z'].slice(0, fn.arity || 1).join(', ')})</span>
                  <div class="action-container">
                    <button class="toggle-btn ${toggleClass}" data-index="${index}">${toggleText}</button>
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="delete-btn" data-index="${index}">Delete</button>
                  </div>
                `;
                fnList.appendChild(item);
            });

            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    funcs[idx].enabled = funcs[idx].enabled === false ? true : false;
                    chrome.storage.local.set({ customFunctions: funcs }, updateList);
                });
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    const fn = funcs[idx];
                    
                    isEditing = true;
                    editingIndex = idx;
                    
                    fnName.value = fn.name;
                    fnArity.value = (fn.arity || 1).toString();
                    renderDynamicFormFields(fn.arity || 1);

                    const inputTypes = fn.inputTypes || Array(fn.arity || 1).fill("I");
                    for (let i = 0; i < inputTypes.length; i++) {
                        const selectEl = document.getElementById(`argType_${i}`);
                        if (selectEl) selectEl.value = inputTypes[i];
                    }

                    fnReturnType.value = fn.returnType || "I";

                    const derivatives = fn.derivatives || Array(fn.arity || 1).fill("0*x_1");
                    for (let i = 0; i < derivatives.length; i++) {
                        const inputEl = document.getElementById(`deriv_${i}`);
                        if (inputEl) inputEl.value = derivatives[i];
                    }
                    
                    fnJs.value = fn.jsBody;
                    fnGlsl.value = fn.glslBody || '';
                    
                    nameLabel.textContent = "Function Name (Edit Mode)";
                    addBtn.textContent = "Save Changes";
                    cancelBtn.style.display = "inline-block";
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    if (isEditing && idx === editingIndex) {
                        resetForm();
                    }
                    funcs.splice(idx, 1);
                    chrome.storage.local.set({ customFunctions: funcs }, updateList);
                });
            });
        });
    }

    fnArity.addEventListener('change', (e) => {
        renderDynamicFormFields(parseInt(e.target.value));
    });

    addBtn.addEventListener('click', () => {
        const name = fnName.value.trim().toLowerCase();
        const arity = parseInt(fnArity.value);
        const jsBody = fnJs.value.trim();
        const glslBody = fnGlsl.value.trim();

        const nameRegex = /^[a-z][a-z0-9_]*$/;
        if (!nameRegex.test(name)) {
            showStatus(formStatus, "Invalid name. Use lowercase a-z and underscores only.", true);
            return;
        }

        if (jsBody === '') {
            showStatus(formStatus, "JavaScript function body is required.", true);
            return;
        }

        const inputTypes = [];
        const derivatives = [];
        for (let i = 0; i < arity; i++) {
            inputTypes.push(document.getElementById(`argType_${i}`).value);
            derivatives.push(document.getElementById(`deriv_${i}`).value.trim());
        }
        const returnType = fnReturnType.value;

        chrome.storage.local.get('customFunctions', (data) => {
            let funcs = data.customFunctions || [];

            const fnObject = {
                name,
                arity,
                inputTypes,
                returnType,
                derivatives,
                jsBody,
                glslBody,
                enabled: true
            };

            if (isEditing && editingIndex !== -1) {
                fnObject.enabled = funcs[editingIndex].enabled !== false;
                funcs[editingIndex] = fnObject;
                showStatus(formStatus, "Function updated successfully!");
            } else {
                const existingIndex = funcs.findIndex(f => f.name === name);
                if (existingIndex !== -1) {
                    funcs[existingIndex] = fnObject;
                    showStatus(formStatus, "Function updated successfully!");
                } else {
                    funcs.push(fnObject);
                    showStatus(formStatus, "Function added successfully!");
                }
            }

            chrome.storage.local.set({ customFunctions: funcs }, () => {
                resetForm();
                updateList();
            });
        });
    });

    saveLibsBtn.addEventListener('click', () => {
        const js = sharedJS.value;
        const glsl = sharedGLSL.value;
        chrome.storage.local.set({ sharedJS: js, sharedGLSL: glsl }, () => {
            showStatus(libsStatus, "Libraries saved successfully!");
        });
    });

    cancelBtn.addEventListener('click', resetForm);

    initializeAndLoad();
});
