/**
 * CRYPTO VAULT - Client-Side Cryptography Pipeline
 * Powered by Web Crypto API (AES-GCM-256, PBKDF2)
 */

// UI State variables
let currentOperation = 'encrypt'; // 'encrypt' or 'decrypt'
let currentMode = 'file';        // 'file' or 'text'
let selectedFile = null;

// UI Elements
const tabEncrypt = document.getElementById('tab-encrypt');
const tabDecrypt = document.getElementById('tab-decrypt');
const modeFile = document.getElementById('mode-file');
const modeText = document.getElementById('mode-text');
const panelFile = document.getElementById('panel-file');
const panelText = document.getElementById('panel-text');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileHud = document.getElementById('file-hud');
const hudFileName = document.getElementById('hud-file-name');
const hudFileSize = document.getElementById('hud-file-size');
const btnRemoveFile = document.getElementById('btn-remove-file');
const textInput = document.getElementById('text-input');
const charCounter = document.getElementById('char-counter');
const passwordInput = document.getElementById('password-input');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const strengthBar = document.getElementById('strength-bar');
const strengthLabel = document.getElementById('strength-label');
const btnAction = document.getElementById('btn-action');
const progressOverlay = document.getElementById('progress-overlay');
const progressStatus = document.getElementById('progress-status');
const resultsPanel = document.getElementById('results-panel');
const btnCopyResult = document.getElementById('btn-copy-result');
const textResultWrapper = document.getElementById('text-result-wrapper');
const textOutput = document.getElementById('text-output');
const fileResultWrapper = document.getElementById('file-result-wrapper');
const resultFileTitle = document.getElementById('result-file-title');
const resultFileDetails = document.getElementById('result-file-details');
const btnDownloadFile = document.getElementById('btn-download-file');

// Result payload references
let resultFileData = null;
let resultFileName = '';
let resultFileType = '';

/* =========================================================================
   UI EVENT HANDLERS & TABS
   ========================================================================= */

// Switch Operation Tabs (Encrypt / Decrypt)
tabEncrypt.addEventListener('click', () => setOperation('encrypt'));
tabDecrypt.addEventListener('click', () => setOperation('decrypt'));

function setOperation(op) {
  currentOperation = op;
  tabEncrypt.classList.toggle('active', op === 'encrypt');
  tabDecrypt.classList.toggle('active', op === 'decrypt');
  btnAction.innerText = `${op.toUpperCase()} PAYLOAD`;
  
  // Clear outputs
  hideResults();
  
  if (op === 'decrypt') {
    dropZone.querySelector('.drop-text-primary').innerText = 'Drag & drop encrypted (.enc) file';
    dropZone.querySelector('.drop-text-secondary').innerText = 'or click to browse encrypted files';
  } else {
    dropZone.querySelector('.drop-text-primary').innerText = 'Drag & drop your file here';
    dropZone.querySelector('.drop-text-secondary').innerText = 'or click to browse from device';
  }
}

// Switch Mode Selectors (File / Text)
modeFile.addEventListener('click', () => setMode('file'));
modeText.addEventListener('click', () => setMode('text'));

function setMode(mode) {
  currentMode = mode;
  modeFile.classList.toggle('active', mode === 'file');
  modeText.classList.toggle('active', mode === 'text');
  panelFile.classList.toggle('active', mode === 'file');
  panelText.classList.toggle('active', mode === 'text');
  hideResults();
}

// Show/Hide Password Toggle
btnTogglePassword.addEventListener('click', () => {
  const isPass = passwordInput.type === 'password';
  passwordInput.type = isPass ? 'text' : 'password';
  btnTogglePassword.querySelector('svg').style.color = isPass ? 'var(--color-primary)' : 'var(--color-text-muted)';
});

// Character counter for Textarea
textInput.addEventListener('input', () => {
  charCounter.innerText = `${textInput.value.length} characters`;
});

// Password strength analyzer
passwordInput.addEventListener('input', () => {
  const pw = passwordInput.value;
  let score = 0;
  
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  
  strengthBar.className = 'strength-bar';
  if (pw.length === 0) {
    strengthLabel.innerText = 'Passphrase Strength';
    strengthLabel.style.color = 'var(--color-text-muted)';
  } else if (score <= 1) {
    strengthBar.classList.add('weak');
    strengthLabel.innerText = 'Weak (Needs length/symbols)';
    strengthLabel.style.color = 'var(--color-accent)';
  } else if (score <= 3) {
    strengthBar.classList.add('medium');
    strengthLabel.innerText = 'Medium (Add capital/numbers)';
    strengthLabel.style.color = '#ffd000';
  } else {
    strengthBar.classList.add('strong');
    strengthLabel.innerText = 'Strong Secure Passphrase';
    strengthLabel.style.color = 'var(--color-primary)';
  }
});

/* =========================================================================
   DRAG-AND-DROP FILE UPLOADER HANDLERS
   ========================================================================= */

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleSelectedFile(e.target.files[0]);
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    handleSelectedFile(e.dataTransfer.files[0]);
  }
});

function handleSelectedFile(file) {
  selectedFile = file;
  hudFileName.innerText = file.name;
  hudFileSize.innerText = formatBytes(file.size);
  
  dropZone.querySelector('.drop-zone-content').classList.add('hidden');
  fileHud.classList.remove('hidden');
  hideResults();
}

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation(); // Stop click triggering folder prompt
  clearFileSelection();
});

function clearFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.querySelector('.drop-zone-content').classList.remove('hidden');
  fileHud.classList.add('hidden');
  hideResults();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* =========================================================================
   CRYPTOGRAPHY CORE API PIPELINE (AES-GCM-256 & PBKDF2)
   ========================================================================= */

// Derive AES Key using password string and Salt buffer
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  
  // 1. Import passphrase as raw Key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // 2. Perform PBKDF2 Key Derivation over 100,000 iterations
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Main Encrypt Function
async function encryptPayload(dataBuffer, passphrase, fileMetadata = null) {
  // 1. Generate random Salt (16 bytes) and random IV (12 bytes)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // 2. Derive cryptographic AES key from password
  const aesKey = await deriveKey(passphrase, salt);
  
  let plaintextBytes = new Uint8Array(dataBuffer);
  
  // 3. If file metadata is provided, inject metadata header inside the encrypted payload
  if (fileMetadata) {
    const metaStr = JSON.stringify(fileMetadata);
    const metaBytes = new TextEncoder().encode(metaStr);
    
    // Header struct: [JSON length (4 bytes)] + [JSON bytes] + [Original file data]
    const headerLen = new Uint8Array(4);
    new DataView(headerLen.buffer).setUint32(0, metaBytes.byteLength, false); // big-endian
    
    const combined = new Uint8Array(4 + metaBytes.byteLength + plaintextBytes.byteLength);
    combined.set(headerLen, 0);
    combined.set(metaBytes, 4);
    combined.set(plaintextBytes, 4 + metaBytes.byteLength);
    
    plaintextBytes = combined;
  }
  
  // 4. Encrypt plaintext payload using AES-GCM
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    plaintextBytes
  );
  
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);
  
  // 5. Structure final payload: [Salt (16)] + [IV (12)] + [Ciphertext + Tag]
  const finalPayload = new Uint8Array(16 + 12 + ciphertextBytes.byteLength);
  finalPayload.set(salt, 0);
  finalPayload.set(iv, 16);
  finalPayload.set(ciphertextBytes, 16 + 12);
  
  return finalPayload;
}

// Main Decrypt Function
async function decryptPayload(encryptedBytes, passphrase, isFileDecryption = false) {
  if (encryptedBytes.byteLength < 28) {
    throw new Error("Payload is corrupted or too small to contain valid Salt/IV headers.");
  }
  
  // 1. Slice Salt, IV and Ciphertext
  const salt = encryptedBytes.slice(0, 16);
  const iv = encryptedBytes.slice(16, 28);
  const ciphertext = encryptedBytes.slice(28);
  
  // 2. Derive key from password and sliced salt
  const aesKey = await deriveKey(passphrase, salt);
  
  // 3. Decrypt ciphertext buffer
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    ciphertext
  );
  
  const decryptedBytes = new Uint8Array(decryptedBuffer);
  
  // 4. If decrypting file mode, unpack the metadata header
  if (isFileDecryption) {
    if (decryptedBytes.byteLength < 4) {
      throw new Error("Decrypted file payload header is corrupted.");
    }
    
    const view = new DataView(decryptedBytes.buffer);
    const metaLen = view.getUint32(0, false);
    
    if (decryptedBytes.byteLength < 4 + metaLen) {
      throw new Error("Decrypted file payload metadata is corrupted.");
    }
    
    const metaBytes = decryptedBytes.slice(4, 4 + metaLen);
    const metaStr = new TextDecoder().decode(metaBytes);
    const fileMetadata = JSON.parse(metaStr);
    
    const originalFileBytes = decryptedBytes.slice(4 + metaLen);
    
    return {
      data: originalFileBytes,
      name: fileMetadata.name,
      type: fileMetadata.type
    };
  }
  
  return decryptedBytes;
}

/* =========================================================================
   UI TRIGGERS & BUFFER PROCESSING
   ========================================================================= */

btnAction.addEventListener('click', async () => {
  const password = passwordInput.value;
  if (!password) {
    alert("Please enter a secure security passphrase.");
    return;
  }
  
  hideResults();
  
  if (currentMode === 'file') {
    if (!selectedFile) {
      alert("Please select or drop a file first.");
      return;
    }
    
    showLoader(currentOperation === 'encrypt' ? "Encrypting file..." : "Decrypting file...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileBuffer = e.target.result;
        
        if (currentOperation === 'encrypt') {
          // Encrypt file
          const metadata = {
            name: selectedFile.name,
            type: selectedFile.type
          };
          const encData = await encryptPayload(fileBuffer, password, metadata);
          
          resultFileData = encData;
          resultFileName = selectedFile.name + '.enc';
          resultFileType = 'application/octet-stream';
          
          showFileResults(resultFileName, encData.byteLength);
        } else {
          // Decrypt file
          const decResult = await decryptPayload(new Uint8Array(fileBuffer), password, true);
          
          resultFileData = decResult.data;
          resultFileName = decResult.name;
          resultFileType = decResult.type;
          
          showFileResults(resultFileName, decResult.data.byteLength);
        }
      } catch (err) {
        console.error(err);
        alert(currentOperation === 'encrypt' ? "Encryption failed." : "Decryption failed. Please verify your password.");
      } finally {
        hideLoader();
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
      hideLoader();
    };
    reader.readAsArrayBuffer(selectedFile);
    
  } else {
    // Text Mode
    const textVal = textInput.value;
    if (!textVal) {
      alert("Please enter text message content.");
      return;
    }
    
    showLoader(currentOperation === 'encrypt' ? "Encrypting message..." : "Decrypting message...");
    
    setTimeout(async () => {
      try {
        if (currentOperation === 'encrypt') {
          // Encrypt Text: Convert string to arrayBuffer, encrypt, then base64 format the output
          const encTextBytes = new TextEncoder().encode(textVal);
          const encPayload = await encryptPayload(encTextBytes.buffer, password);
          
          // Convert binary result to Base64
          const base64Str = btoa(String.fromCharCode.apply(null, encPayload));
          
          showTextResults(base64Str);
        } else {
          // Decrypt Text: Convert base64 input to binary, decrypt, then decode to UTF-8 string
          let binaryStr;
          try {
            binaryStr = atob(textVal.trim());
          } catch(e) {
            throw new Error("Invalid base64 characters.");
          }
          
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          
          const decBytes = await decryptPayload(bytes, password);
          const decodedText = new TextDecoder().decode(decBytes);
          
          showTextResults(decodedText);
        }
      } catch (err) {
        console.error(err);
        alert(currentOperation === 'encrypt' ? "Encryption failed." : "Decryption failed. Verify your ciphertext and password.");
      } finally {
        hideLoader();
      }
    }, 50); // delay to let spinner render
  }
});

// Download processed file
btnDownloadFile.addEventListener('click', () => {
  if (!resultFileData) return;
  
  const blob = new Blob([resultFileData], { type: resultFileType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = resultFileName;
  document.body.appendChild(a);
  a.click();
  
  // Clean up URL object references
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
});

// Copy output results
btnCopyResult.addEventListener('click', () => {
  textOutput.select();
  document.execCommand('copy');
  
  btnCopyResult.innerText = 'COPIED!';
  setTimeout(() => {
    btnCopyResult.innerText = 'COPY';
  }, 1500);
});

/* =========================================================================
   UI DISPLAY CONTROLLER HELPERS
   ========================================================================= */

function showLoader(statusText) {
  progressStatus.innerText = statusText;
  progressOverlay.classList.remove('hidden');
}

function hideLoader() {
  progressOverlay.classList.add('hidden');
}

function showFileResults(fileName, sizeBytes) {
  resultFileTitle.innerText = fileName;
  resultFileDetails.innerText = `Size: ${formatBytes(sizeBytes)} | Ready to Download`;
  
  fileResultWrapper.classList.remove('hidden');
  textResultWrapper.classList.add('hidden');
  btnCopyResult.classList.add('hidden');
  resultsPanel.classList.remove('hidden');
}

function showTextResults(text) {
  textOutput.value = text;
  
  fileResultWrapper.classList.add('hidden');
  textResultWrapper.classList.remove('hidden');
  btnCopyResult.classList.remove('hidden');
  resultsPanel.classList.remove('hidden');
}

function hideResults() {
  resultsPanel.classList.add('hidden');
  fileResultWrapper.classList.add('hidden');
  textResultWrapper.classList.add('hidden');
  resultFileData = null;
}
