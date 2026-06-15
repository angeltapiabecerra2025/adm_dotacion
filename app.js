document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropzoneInicio = document.getElementById('dropzone-inicio');
    const fileInicio = document.getElementById('file-inicio');
    const nameInicio = document.getElementById('name-inicio');
    
    const dropzoneFin = document.getElementById('dropzone-fin');
    const fileFin = document.getElementById('file-fin');
    const nameFin = document.getElementById('name-fin');
    
    const btnProcess = document.getElementById('btn-process');
    const loader = document.getElementById('loader');
    const resultsSection = document.getElementById('results-section');
    
    // Data state
    let dataInicio = null;
    let dataFin = null;
    let dataDepuracion = null;
    
    // UI Elements Depuracion
    const dropzoneDepuracion = document.getElementById('dropzone-depuracion');
    const fileDepuracion = document.getElementById('file-depuracion');
    const nameDepuracion = document.getElementById('name-depuracion');
    const btnProcessDepuracion = document.getElementById('btn-process-depuracion');
    
    // Persisted Summary Storage
    let globalSummaryData = {};

    // --- IndexedDB Setup para memoria ilimitada ---
    const DB_NAME = "CubiDashDB";
    const STORE_NAME = "proyectos_v3"; // v3 para limpiar datos antiguos corruptos y usar nuevo formato de ID

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 3);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveProjectsToDB(statsArray) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            statsArray.forEach(stat => store.put(stat));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function loadAllFromDB() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteProjectFromDB(projName) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.delete(projName);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Inicializar cargando desde BD
    loadAllFromDB().then(data => {
        data.forEach(stat => {
            globalSummaryData[stat.id] = stat;
        });
        renderSummary();
    }).catch(e => console.error("Error al cargar la base de datos:", e));

    // --- Helpers ---
    function parseExcelDate(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val; // Excel serial date
        
        const str = String(val).trim();
        const parts = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (parts) {
            const d = parts[1].padStart(2, '0');
            const m = parts[2].padStart(2, '0');
            const y = parts[3];
            return parseInt(`${y}${m}${d}`, 10);
        }
        
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.getTime();
        
        return 0;
    }

    function parseToISODate(val) {
        if (!val) return "";
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        const str = String(val).trim();
        const parts = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (parts) {
            const d = parts[1].padStart(2, '0');
            const m = parts[2].padStart(2, '0');
            const y = parts[3];
            return `${y}-${m}-${d}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
        return "";
    }

    // --- Event Listeners for File Inputs ---
    function handleFileDrop(e, inputEl, nameEl, dropzoneEl, isInicio) {
        e.preventDefault();
        dropzoneEl.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            inputEl.files = e.dataTransfer.files;
            processFile(file, nameEl, dropzoneEl, isInicio);
        }
    }

    function handleFileSelect(e, nameEl, dropzoneEl, isInicio) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            processFile(file, nameEl, dropzoneEl, isInicio);
        }
    }

    dropzoneInicio.addEventListener('dragover', (e) => { e.preventDefault(); dropzoneInicio.classList.add('dragover'); });
    dropzoneInicio.addEventListener('dragleave', () => dropzoneInicio.classList.remove('dragover'));
    dropzoneInicio.addEventListener('drop', (e) => handleFileDrop(e, fileInicio, nameInicio, dropzoneInicio, true));
    fileInicio.addEventListener('change', (e) => handleFileSelect(e, nameInicio, dropzoneInicio, true));

    dropzoneFin.addEventListener('dragover', (e) => { e.preventDefault(); dropzoneFin.classList.add('dragover'); });
    dropzoneFin.addEventListener('dragleave', () => dropzoneFin.classList.remove('dragover'));
    dropzoneFin.addEventListener('drop', (e) => handleFileDrop(e, fileFin, nameFin, dropzoneFin, false));
    fileFin.addEventListener('change', (e) => handleFileSelect(e, nameFin, dropzoneFin, false));

    if (dropzoneDepuracion) {
        dropzoneDepuracion.addEventListener('dragover', (e) => { e.preventDefault(); dropzoneDepuracion.classList.add('dragover'); });
        dropzoneDepuracion.addEventListener('dragleave', () => dropzoneDepuracion.classList.remove('dragover'));
        dropzoneDepuracion.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzoneDepuracion.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                fileDepuracion.files = e.dataTransfer.files;
                processFileDepuracion(file);
            }
        });
        fileDepuracion.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                processFileDepuracion(file);
            }
        });
    }

    // --- File Processing Functions ---
    function processFile(file, nameEl, dropzoneEl, isInicio) {
        nameEl.textContent = file.name;
        dropzoneEl.classList.add('has-file');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Buscar hoja que contenga "reporte diario" o usar la primera como respaldo
            let targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('reporte diario'));
            if (!targetSheetName) {
                console.warn("No se encontró hoja con nombre 'reporte diario', usando la primera hoja.");
                targetSheetName = workbook.SheetNames[0];
            }
            const worksheet = workbook.Sheets[targetSheetName];
            
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            
            // Extract project directly from cell E3 and date from E4
            const cellE3 = worksheet['E3'];
            const cellE4 = worksheet['E4'];
            let projectName = cellE3 ? String(cellE3.v || cellE3.w || "").trim() : "";
            if (!projectName) projectName = "Proyecto General"; 
            const dateValue = cellE4 ? String(cellE4.v || cellE4.w || "").trim() : "";
            
            let headerRowIndex = 5; 
            for (let i = 0; i < Math.min(rawJson.length, 20); i++) {
                const rowStr = (rawJson[i] || []).join('').toUpperCase();
                if (rowStr.includes('RUT') && (rowStr.includes('NOMBRE') || rowStr.includes('ASISTENCIA'))) {
                    headerRowIndex = i;
                    break;
                }
            }
            
            // Build standardized objects with RUT deduplication (keep newest Date)
            const headerRow = rawJson[headerRowIndex] || [];
            const tempMap = new Map();
            
            for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
                const rawRow = rawJson[i] || [];
                if (rawRow.length === 0 || !rawRow.some(cell => String(cell).trim() !== '')) continue;
                
                const newRow = { _rawRow: rawRow, _proyecto_encontrado: projectName };
                let dateColName = null;

                for (let c = 0; c < headerRow.length; c++) {
                    const h = String(headerRow[c] || "").trim().toUpperCase();
                    if (h) {
                        newRow[h] = rawRow[c];
                        if (h.includes('FECHA') && h.includes('INGRES')) dateColName = h;
                    }
                }
                
                const rut = String(newRow['RUT'] || "").trim().toUpperCase();
                if (rut) {
                    const existingRow = tempMap.get(rut);
                    if (existingRow) {
                        const newDate = dateColName ? parseExcelDate(newRow[dateColName]) : 0;
                        const oldDate = dateColName ? parseExcelDate(existingRow[dateColName]) : 0;
                        if (newDate > oldDate) {
                            tempMap.set(rut, newRow);
                        }
                    } else {
                        tempMap.set(rut, newRow);
                    }
                }
            }
            
            const fileData = { 
                filename: file.name, 
                data: Array.from(tempMap.values()), 
                projectName: projectName,
                dateValue: dateValue
            };
            
            if (isInicio) dataInicio = fileData;
            else dataFin = fileData;
            
            checkReady();
        };
        reader.readAsArrayBuffer(file);
    }

    function processFileDepuracion(file) {
        nameDepuracion.textContent = file.name;
        dropzoneDepuracion.classList.add('has-file');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Buscar la hoja llamada exactamente 'X' (o que contenga solo 'X')
            let targetSheetName = workbook.SheetNames.find(n => n.trim().toUpperCase() === 'X');
            if (!targetSheetName) {
                alert("Advertencia: No se encontró una hoja llamada 'X' en el archivo. Se usará la primera hoja disponible: '" + workbook.SheetNames[0] + "'");
                targetSheetName = workbook.SheetNames[0];
            }
            const worksheet = workbook.Sheets[targetSheetName];
            
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            dataDepuracion = { filename: file.name, rawJson: rawJson, sheetUsed: targetSheetName };
            
            btnProcessDepuracion.disabled = false;
            nameDepuracion.textContent = file.name + " (Hoja: " + targetSheetName + ")";
        };
        reader.readAsArrayBuffer(file);
    }

    function checkReady() {
        if (dataInicio && dataFin) {
            btnProcess.disabled = false;
        }
    }

    // --- Main Logic ---
    const modalSemana = document.getElementById('modal-semana');
    const inputSemanaDesde = document.getElementById('input-semana-desde');
    const inputSemanaHasta = document.getElementById('input-semana-hasta');
    const btnCancelSemana = document.getElementById('btn-cancel-semana');
    const btnConfirmSemana = document.getElementById('btn-confirm-semana');

    btnProcess.addEventListener('click', () => {
        if (!dataInicio || !dataFin) return;
        modalSemana.style.display = 'flex';
        inputSemanaDesde.focus();
    });

    if (btnProcessDepuracion) {
        btnProcessDepuracion.addEventListener('click', async () => {
            if (!dataDepuracion) return;
            
            btnProcessDepuracion.disabled = true;
            btnProcessDepuracion.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle;"></div> Procesando...';
            
            setTimeout(() => {
                try {
                    generarReporteEstandar(dataDepuracion.rawJson, dataDepuracion.filename);
                } catch (err) {
                    console.error(err);
                    alert("Error al procesar el archivo: " + err.message);
                } finally {
                    btnProcessDepuracion.disabled = false;
                    btnProcessDepuracion.innerHTML = '<i class="ph ph-magic-wand"></i> Generar Reporte Estándar';
                }
            }, 500);
        });
    }

    function generarReporteEstandar(rawJson, originalFilename) {
        // 1. Buscar la fila de encabezado de la tabla (necesita RUT y NOMBRE juntos)
        let sourceHeaderIndex = -1;
        for (let i = 0; i < rawJson.length; i++) {
            const cells = (rawJson[i] || []).map(c => String(c).trim().toUpperCase());
            const hasRut    = cells.some(c => c === 'RUT' || c.startsWith('RUT'));
            const hasNombre = cells.some(c => c === 'NOMBRE' || c.includes('NOMBRE'));
            if (hasRut && hasNombre) { sourceHeaderIndex = i; break; }
        }
        if (sourceHeaderIndex === -1) {
            throw new Error("No se encontró la fila de encabezado de la tabla en la hoja X (necesita columnas RUT y NOMBRE).");
        }
        
        const sourceHeader = rawJson[sourceHeaderIndex] || [];
        
        // 2. Determinar los límites exactos de la tabla (primera y última columna con valor)
        let tableColStart = -1, tableColEnd = -1;
        for (let c = 0; c < sourceHeader.length; c++) {
            if (String(sourceHeader[c]).trim() !== '') {
                if (tableColStart === -1) tableColStart = c;
                tableColEnd = c;
            }
        }
        if (tableColStart === -1) throw new Error("No se pudo determinar el ancho de la tabla.");
        
        // 3. Mapear índices de columnas SOLO dentro del rango de la tabla
        const headerSlice = sourceHeader.slice(tableColStart, tableColEnd + 1);
        const findColIdx = (testFn) => {
            const li = headerSlice.findIndex(c => testFn(String(c).trim().toUpperCase()));
            return li >= 0 ? tableColStart + li : -1;
        };
        
        const idxN       = findColIdx(v => /^(N°|Nº|N|NO\.)$/.test(v));
        const idxRut     = findColIdx(v => v === 'RUT' || v.startsWith('RUT'));
        const idxNombre  = findColIdx(v => v.includes('NOMBRE'));
        const idxCargo   = findColIdx(v => v.includes('CARGO'));
        const idxFecha   = findColIdx(v => v.includes('FECHA') && v.includes('INGRESO'));
        const idxJornada = findColIdx(v => /^(JORNADA|TURNO)$/.test(v));
        
        // 4. Extraer SOLO las filas de la tabla
        //    Parar: fila vacía dentro del rango de tabla (fin de tabla) o fila con FINIQUITO
        const extractedData = [];
        let emptyCount = 0;
        
        for (let i = sourceHeaderIndex + 1; i < rawJson.length; i++) {
            const row = rawJson[i] || [];
            const tableCells = row.slice(tableColStart, tableColEnd + 1);
            const isTableRowEmpty = tableCells.every(c => String(c).trim() === '');
            
            if (isTableRowEmpty) {
                emptyCount++;
                if (emptyCount >= 2) break; // 2 filas vacías seguidas = fin de tabla
                continue;
            }
            emptyCount = 0;
            
            const rowText = tableCells.map(c => String(c).trim().toUpperCase()).join(' ');
            if (rowText.includes('FINIQUITO')) break; // sección de finiquitos = parar
            
            const rut = idxRut >= 0 ? String(row[idxRut] || '').trim() : '';
            if (!rut) continue; // saltar fila sin RUT
            
            extractedData.push({
                n:       idxN       >= 0 ? row[idxN]       : '',
                rut:     rut,
                nombre:  idxNombre  >= 0 ? row[idxNombre]  : '',
                cargo:   idxCargo   >= 0 ? row[idxCargo]   : '',
                fecha:   idxFecha   >= 0 ? row[idxFecha]   : '',
                jornada: idxJornada >= 0 ? row[idxJornada] : ''
            });
        }
        
        if (extractedData.length === 0) {
            throw new Error("No se encontraron filas con RUT dentro de la tabla. Verifique que el archivo tenga la hoja 'X' con datos.");
        }
        
        if (typeof TEMPLATE_ESTANDAR_BASE64 === 'undefined') {
            throw new Error("La plantilla estándar no está cargada. Recargue la página con Ctrl+F5.");
        }
        
        // 5. Cargar la plantilla y localizar la hoja Reporte Diario
        const wb = XLSX.read(TEMPLATE_ESTANDAR_BASE64, { type: 'base64', bookVBA: true });
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('reporte diario')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const wsRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50');
        
        // 6. Buscar fila de encabezados en la PLANTILLA leyendo celdas directamente
        //    (evita falsos positivos por errores tipo #¿NOMBRE?)
        let tHeaderRow = -1;
        const tColMap = {};
        
        for (let r = wsRange.s.r; r <= Math.min(wsRange.e.r, 30); r++) {
            let foundRut = false, foundNombre = false;
            const rowMap = {};
            for (let c = wsRange.s.c; c <= wsRange.e.c; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                if (!cell || cell.t === 'e') continue;
                const val = String(cell.v || '').trim().toUpperCase();
                if (!val) continue;
                if (val === 'RUT' || val.startsWith('RUT')) { rowMap['RUT'] = c; foundRut = true; }
                if (val.includes('NOMBRE')) { rowMap['NOMBRE'] = c; foundNombre = true; }
                if (/^(N°|Nº|N|NO\.)$/.test(val)) rowMap['N'] = c;
                if (val.includes('CARGO')) rowMap['CARGO'] = c;
                if (val.includes('FECHA') && val.includes('INGRESO')) rowMap['FECHA'] = c;
                if (/^(JORNADA|TURNO)$/.test(val)) rowMap['JORNADA'] = c;
            }
            if (foundRut && foundNombre) {
                tHeaderRow = r;
                Object.assign(tColMap, rowMap);
                break;
            }
        }
        
        if (tHeaderRow === -1) {
            throw new Error("No se encontró la fila de encabezados en la hoja Reporte Diario de la plantilla.");
        }
        
        // 7. Escribir datos celda por celda (sobreescribe fórmulas y errores)
        const dataStartRow = tHeaderRow + 1;
        extractedData.forEach((d, i) => {
            const r = dataStartRow + i;
            const setCel = (key, val) => {
                const c = tColMap[key];
                if (c === undefined || val === null || val === undefined || val === '') return;
                const addr = XLSX.utils.encode_cell({ r, c });
                const numVal = (typeof val === 'number') ? val : Number(val);
                ws[addr] = (!isNaN(numVal) && String(val).trim() !== '')
                    ? { t: 'n', v: numVal }
                    : { t: 's', v: String(val) };
            };
            setCel('N',       d.n);
            setCel('RUT',     d.rut);
            setCel('NOMBRE',  d.nombre);
            setCel('CARGO',   d.cargo);
            setCel('FECHA',   d.fecha);
            setCel('JORNADA', d.jornada);
        });
        
        wsRange.e.r = Math.max(wsRange.e.r, dataStartRow + extractedData.length - 1);
        ws['!ref'] = XLSX.utils.encode_range(wsRange);
        
        XLSX.writeFile(wb, "Reporte_Estandarizado_" + originalFilename.replace(/\.[^/.]+$/, "") + ".xlsm", { bookSST: true, bookVBA: true });
        alert("Proceso exitoso: " + extractedData.length + " registros exportados al Reporte Estándar.");
    }

    btnCancelSemana.addEventListener('click', () => {
        modalSemana.style.display = 'none';
        inputSemanaDesde.value = '';
        inputSemanaHasta.value = '';
    });

    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return dateStr;
    }

    btnConfirmSemana.addEventListener('click', async () => {
        const desdeVal = inputSemanaDesde.value;
        const hastaVal = inputSemanaHasta.value;
        
        let manualSemanaName = "Semana (Sin fecha)";
        if (desdeVal && hastaVal) {
            manualSemanaName = `${formatDateForDisplay(desdeVal)} al ${formatDateForDisplay(hastaVal)}`;
        } else if (desdeVal) {
            manualSemanaName = `Desde ${formatDateForDisplay(desdeVal)}`;
        } else if (hastaVal) {
            manualSemanaName = `Hasta ${formatDateForDisplay(hastaVal)}`;
        }

        const customIsoDate = desdeVal || hastaVal || "";

        modalSemana.style.display = 'none';
        inputSemanaDesde.value = '';
        inputSemanaHasta.value = '';

        btnProcess.disabled = true;
        loader.style.display = 'flex';
        resultsSection.style.display = 'none';
        
        // Timeout just for UX smooth loader
        setTimeout(async () => {
            await analyzeData({ name: manualSemanaName, isoDate: customIsoDate, desdeDate: desdeVal, hastaDate: hastaVal });
            loader.style.display = 'none';
            resultsSection.style.display = 'block';
            btnProcess.disabled = false;
        }, 800);
    });

    const turnosSection = document.getElementById('turnos-section');
    const balanceSection = document.getElementById('balance-section');
    const distribucionSection = document.getElementById('distribucion-section');
    const generoSection = document.getElementById('genero-section');
    const historicoSection = document.getElementById('historico-section');
    const depuracionSection = document.getElementById('depuracion-section');

    function showAllSections() {
        resultsSection.style.display = 'block';
        if (turnosSection) turnosSection.style.display = 'block';
        if (balanceSection) balanceSection.style.display = 'block';
        if (distribucionSection) distribucionSection.style.display = 'block';
        if (generoSection) generoSection.style.display = 'block';
        if (historicoSection) historicoSection.style.display = 'block';
        if (depuracionSection) depuracionSection.style.display = 'block';
    }

    document.getElementById('btn-historial')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-turnos')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (turnosSection) turnosSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-balance')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (balanceSection) balanceSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-distribucion')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (distribucionSection) distribucionSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-genero')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (generoSection) generoSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-historico')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (historicoSection) historicoSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-depuracion')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAllSections();
        if (depuracionSection) depuracionSection.scrollIntoView({ behavior: 'smooth' });
    });

    function cleanStateString(state) {
        if (state === undefined || state === null) return "";
        return String(state).trim().toUpperCase();
    }

    // Case-insensitive column lookup: finds the first key that contains any of the given substrings
    function getCol(row, ...names) {
        const keys = Object.keys(row);
        for (const name of names) {
            const nameUp = name.toUpperCase();
            const found = keys.find(k => k.trim().toUpperCase() === nameUp);
            if (found !== undefined && row[found] !== undefined && row[found] !== '') return row[found];
        }
        // fallback: partial match
        for (const name of names) {
            const nameUp = name.toUpperCase();
            const found = keys.find(k => k.trim().toUpperCase().includes(nameUp));
            if (found !== undefined && row[found] !== undefined && row[found] !== '') return row[found];
        }
        return '';
    }

    function formatRut(rut) {
        if (!rut) return "";
        return String(rut).replace(/[^0-9Kk]/g, '').toUpperCase();
    }

    async function analyzeData(semanaInfo) {
        const mapInicio = new Map();
        dataInicio.data.forEach(row => { mapInicio.set(formatRut(row.RUT), row); });

        const mapFin = new Map();
        dataFin.data.forEach(row => { mapFin.set(formatRut(row.RUT), row); });

        const cleanInicioData = [];
        const cleanFinData = [];
        const currentUploadStats = {};

        function getProjectName(row1, row2) {
            return (row2 && row2._proyecto_encontrado) || (row1 && row1._proyecto_encontrado) || 'Desconocido';
        }

        function initProjectStats(proj) {
            if (!currentUploadStats[proj]) {
                currentUploadStats[proj] = {
                    proyecto: proj, dotInicio: 0, dotTermino: 0, dotFinal: 0, vigentes: 0,
                    ingresos: 0, finiquitos: 0, licencia: 0, mod: 0, moi: 0, hombres: 0, mujeres: 0,
                    turnos_mod: { '04X03': 0, '05X02': 0, '06X01': 0, '07X07': 0, '08X06': 0, '14X14': 0, '15X13': 0, '21X07': 0 },
                    turnos_moi: { '04X03': 0, '05X02': 0, '06X01': 0, '07X07': 0, '08X06': 0, '14X14': 0, '15X13': 0, '21X07': 0 }
                };
            }
            return currentUploadStats[proj];
        }

        dataInicio.data.forEach(rowInicio => {
            const rut = formatRut(rowInicio.RUT);
            const stateInicio = cleanStateString(rowInicio.ASISTENCIA);
            
            // "todos aquellos que estan como finiquitados en la planilla de inicio no se deben considerar"
            if (stateInicio.includes('FINIQUITADO')) {
                return;
            }

            const rowFin = mapFin.get(rut);
            const proj = getProjectName(rowInicio, rowFin);
            const stats = initProjectStats(proj);

            cleanInicioData.push(rowInicio);
            stats.dotInicio++;
        });

        dataFin.data.forEach(rowFin => {
            const rut = formatRut(rowFin.RUT);
            const rowInicio = mapInicio.get(rut);
            const stateInicio = rowInicio ? cleanStateString(rowInicio.ASISTENCIA) : null;
            
            // "todos aquellos que estan como finiquitados en la planilla de inicio no se deben considerar ni en la planilla de inicio ni en la de fin"
            if (stateInicio && stateInicio.includes('FINIQUITADO')) {
                return;
            }

            const stateFin = cleanStateString(rowFin.ASISTENCIA);
            const proj = getProjectName(rowInicio, rowFin);
            const stats = initProjectStats(proj);

            cleanFinData.push(rowFin);
            stats.dotFinal++;
            
            const isFiniquito = stateFin.includes('FINIQUITADO');
            const isIngreso = !rowInicio || stateInicio === '#N/D' || stateInicio === '';
            const isLicencia = stateFin.includes('LICENCIA');
            
            if (isFiniquito) {
                stats.finiquitos++;
            } else if (isIngreso) {
                stats.ingresos++;
            } else if (isLicencia) {
                stats.licencia++;
            } else {
                stats.vigentes++;
            }

            // MOD Y MOI deben dar la misma cantidad que la DOT.FINAL
            let isMoi = false;
            const tipoMO = cleanStateString(getCol(rowFin, 'TIPO MO', 'TIPO_MO', 'TIPOMO', 'TIPO DE MO', 'TIPO'));
            if (tipoMO.includes('MOI')) {
                stats.moi++;
                isMoi = true;
            } else {
                stats.mod++;
            }

            // HOMBRES y MUJERES deben dar la misma cantidad que la DOT. FINAL
            const genero = cleanStateString(getCol(rowFin, 'GENERO', 'SEXO', 'GÉNERO'));
            if (genero === 'F' || genero.includes('FEM') || genero === 'MUJER') {
                stats.mujeres++;
            } else {
                stats.hombres++;
            }

            // Distribuir TURNOS - escanear TODAS las columnas candidatas y usar la que tenga un valor de turno válido
            // (el Excel puede tener TURNO=L-V y JORNADA=05X02, necesitamos la que tenga el patrón NxN)
            const turnoPatterns = [
                { key: '04X03', tests: ['04X03','4X3'] },
                { key: '05X02', tests: ['05X02','5X2'] },
                { key: '06X01', tests: ['06X01','6X1'] },
                { key: '07X07', tests: ['07X07','7X7'] },
                { key: '08X06', tests: ['08X06','8X6'] },
                { key: '14X14', tests: ['14X14'] },
                { key: '15X13', tests: ['15X13'] },
                { key: '21X07', tests: ['21X07','21X7'] }
            ];
            function matchTurno(val) {
                const v = cleanStateString(val);
                for (const p of turnoPatterns) {
                    if (p.tests.some(t => v.includes(t))) return p.key;
                }
                return null;
            }
            // Scan all row keys to find any column that has a valid turno value
            let turnoKey = null;
            const candidateCols = Object.keys(rowFin).filter(k => {
                const ku = k.trim().toUpperCase();
                return ku.includes('TURNO') || ku.includes('JORNADA') || ku.includes('HORARIO');
            });
            for (const col of candidateCols) {
                const matched = matchTurno(rowFin[col]);
                if (matched) { turnoKey = matched; break; }
            }

            if (turnoKey) {
                if (isMoi) stats.turnos_moi[turnoKey]++;
                else stats.turnos_mod[turnoKey]++;
            }
        });

        const statsToSave = [];

        // Build pre-indexed maps by project for O(n) row grouping instead of O(n*p) filter
        const inicioRowsByProj = {};
        cleanInicioData.forEach(r => {
            const proj = getProjectName(r, mapFin.get(formatRut(r.RUT)));
            if (!inicioRowsByProj[proj]) inicioRowsByProj[proj] = [];
            inicioRowsByProj[proj].push(r._rawRow);
        });
        const finRowsByProj = {};
        cleanFinData.forEach(r => {
            const proj = getProjectName(mapInicio.get(formatRut(r.RUT)), r);
            if (!finRowsByProj[proj]) finRowsByProj[proj] = [];
            finRowsByProj[proj].push(r._rawRow);
        });

        const dateStr = dataFin.dateValue ? String(dataFin.dateValue).trim() : new Date().toLocaleDateString();
        const isoStr = semanaInfo.isoDate || parseToISODate(dateStr) || new Date().toISOString().split('T')[0];

        Object.keys(currentUploadStats).forEach(proj => {
            const stat = currentUploadStats[proj];
            stat.dotTermino = stat.dotFinal - stat.finiquitos;
            stat.inicioRawRows = inicioRowsByProj[proj] || [];
            stat.finRawRows = finRowsByProj[proj] || [];
            
            // Format dates from YYYY-MM-DD to DD-MM-YYYY if available
            const formatFullDate = (d) => {
                if (!d) return "";
                const p = d.split('-');
                if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
                return d;
            };
            const fDesde = formatFullDate(semanaInfo.desdeDate) || dataInicio.dateValue;
            const fHasta = formatFullDate(semanaInfo.hastaDate) || dataFin.dateValue;

            stat.inicioSourceInfo = { filename: dataInicio.filename, projectName: dataInicio.projectName, dateValue: fDesde };
            stat.finSourceInfo = { filename: dataFin.filename, projectName: dataFin.projectName, dateValue: fHasta };
            stat.fechaSemana = semanaInfo.name;
            stat.isoDate = isoStr;
            stat.semanaDate = isoStr;
            stat.id = `${proj}_${isoStr}`;
            globalSummaryData[stat.id] = stat;
            statsToSave.push(stat);
        });

        // Save to IndexedDB
        try {
            await saveProjectsToDB(statsToSave);
        } catch (e) {
            console.error("IndexedDB error:", e);
            alert("Hubo un error al guardar los registros en la base de datos local.");
        }

        renderSummary();
    }

    function buildExportWorkbookWithTemplateRaw(rawRows, sourceFileObj, prefix) {
        const fileName = prefix + sourceFileObj.filename;
        if (typeof TEMPLATE_BASE64 === 'undefined') {
            console.warn("Plantilla no encontrada, haciendo fallback a xlsx básico.");
            const ws = XLSX.utils.aoa_to_sheet(rawRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Datos");
            return { wb, defaultName: fileName };
        }

        const wb = XLSX.read(TEMPLATE_BASE64, { type: 'base64' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        const projName = sourceFileObj.projectName || "";
        const fechaText = sourceFileObj.dateValue || "";

        XLSX.utils.sheet_add_aoa(ws, [[projName]], { origin: "E3" });
        XLSX.utils.sheet_add_aoa(ws, [[fechaText]], { origin: "E4" });

        const rawTemplate = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        let dataStartRow = 6;
        for (let i = 0; i < Math.min(rawTemplate.length, 20); i++) {
            const rowStr = (rawTemplate[i] || []).join('').toUpperCase();
            if (rowStr.includes('RUT') && (rowStr.includes('NOMBRE') || rowStr.includes('ASISTENCIA'))) {
                dataStartRow = i + 1;
                break;
            }
        }

        if (rawRows && rawRows.length > 0) {
            XLSX.utils.sheet_add_aoa(ws, rawRows, { origin: { r: dataStartRow, c: 0 } });
        }
        
        return { wb, defaultName: fileName };
    }

    // Deferred chart rendering so table shows immediately
    function deferredRender(fn) {
        return new Promise(resolve => {
            requestAnimationFrame(() => { setTimeout(() => { fn(); resolve(); }, 0); });
        });
    }

    async function renderSummary() {
        let data = Object.values(globalSummaryData);
        
        // Apply date filters if any
        const desde = document.getElementById('filter-desde')?.value;
        const hasta = document.getElementById('filter-hasta')?.value;
        if (desde) data = data.filter(stat => stat.isoDate && stat.isoDate >= desde);
        if (hasta) data = data.filter(stat => stat.isoDate && stat.isoDate <= hasta);
        
        // Sort by date descending
        data.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

        // Extraer SOLO el periodo máximo global para los gráficos de estado actual
        let latestData = [];
        if (data.length > 0) {
            const maxIsoDate = data[0].isoDate; // Como está ordenado descendente, el primero es el mayor
            latestData = data.filter(stat => stat.isoDate === maxIsoDate);
        }

        const tbody = document.getElementById('summary-tbody');
        const tfoot = document.getElementById('summary-tfoot');
        const statsContainer = document.getElementById('stats-container');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        statsContainer.innerHTML = '';
        
        let tInicio = 0, tTermino = 0, tFinal = 0, tVigentes = 0, tIngresos = 0, tFiniquitos = 0;
        let tLicencia = 0, tMod = 0, tMoi = 0, tHombres = 0, tMujeres = 0;

        // Calcular los totales de los widgets usando SÓLO el periodo actual
        latestData.forEach(stat => {
            tInicio += stat.dotInicio; tTermino += stat.dotTermino; tFinal += stat.dotFinal; tVigentes += stat.vigentes;
            tIngresos += stat.ingresos; tFiniquitos += stat.finiquitos; tLicencia += stat.licencia;
            tMod += stat.mod; tMoi += stat.moi; tHombres += stat.hombres; tMujeres += stat.mujeres;
        });

        // Generar la tabla de historial mostrando sólo el último periodo
        latestData.forEach(stat => {
            let variacion = stat.dotInicio > 0 ? ((stat.dotTermino - stat.dotInicio) / stat.dotInicio) * 100 : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-gray">${stat.fechaSemana || 'N/A'}</span></td>
                <td style="font-weight: 600; white-space: nowrap;">${stat.proyecto}</td>
                <td>${stat.dotInicio}</td><td>${stat.dotTermino}</td><td>${stat.dotFinal}</td><td>${stat.vigentes}</td>
                <td><span class="badge badge-green">+${stat.ingresos}</span></td>
                <td><span class="badge badge-red">-${stat.finiquitos}</span></td>
                <td>${stat.licencia}</td><td>${stat.mod}</td><td>${stat.moi}</td>
                <td>${stat.hombres}</td><td>${stat.mujeres}</td>
                <td style="color: ${variacion >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
                    ${variacion > 0 ? '+' : ''}${variacion.toFixed(2)}%
                </td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button class="btn-dl-inicio" data-id="${stat.id}" title="Descargar Inicio Depurado" style="background:var(--accent); color:white; border:none; border-radius:6px; width:32px; height:32px; cursor:pointer; font-size:16px;">
                            <i class="ph ph-calendar-plus"></i>
                        </button>
                        <button class="btn-dl-fin" data-id="${stat.id}" title="Descargar Fin Depurado" style="background:var(--primary); color:white; border:none; border-radius:6px; width:32px; height:32px; cursor:pointer; font-size:16px;">
                            <i class="ph ph-calendar-check"></i>
                        </button>
                        <button class="btn-delete" data-id="${stat.id}" style="background:var(--danger-bg); border:none; color:var(--danger); border-radius:6px; width:32px; height:32px; cursor:pointer; font-size:16px;" title="Eliminar registro">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        function getTimestampStr() {
            const now = new Date();
            const d = String(now.getDate()).padStart(2, '0');
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            const hs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            return `${d}-${m}-${y}_${hs}${mins}`;
        }

        document.querySelectorAll('.btn-dl-inicio').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const stat = globalSummaryData[id];
                if(stat && stat.inicioRawRows && stat.inicioSourceInfo) {
                    const result = buildExportWorkbookWithTemplateRaw(stat.inicioRawRows, stat.inicioSourceInfo, 'inicio_semana_');
                    const safeProj = String(stat.proyecto).replace(/[\/\\:*?"<>|]/g, '_').trim();
                    XLSX.writeFile(result.wb, `inicio_semana_${safeProj}.xlsx`);
                } else alert("No hay detalles guardados para esta obra en el archivo de inicio.");
            });
        });

        document.querySelectorAll('.btn-dl-fin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const stat = globalSummaryData[id];
                if(stat && stat.finRawRows && stat.finSourceInfo) {
                    const result = buildExportWorkbookWithTemplateRaw(stat.finRawRows, stat.finSourceInfo, 'termino_semana_');
                    const safeProj = String(stat.proyecto).replace(/[\/\\:*?"<>|]/g, '_').trim();
                    XLSX.writeFile(result.wb, `termino_semana_${safeProj}.xlsx`);
                } else alert("No hay detalles guardados para esta obra en el archivo de fin.");
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idToDelete = e.currentTarget.getAttribute('data-id');
                const stat = globalSummaryData[idToDelete];
                if (confirm(`¿Seguro que deseas eliminar el registro de ${stat.proyecto} (Semana: ${stat.fechaSemana})?`)) {
                    delete globalSummaryData[idToDelete];
                    await deleteProjectFromDB(idToDelete);
                    renderSummary();
                }
            });
        });
        
        let tVariacion = tInicio > 0 ? ((tTermino - tInicio) / tInicio) * 100 : 0;
        tfoot.innerHTML = `
            <tr>
                <td>TOTAL GENERAL</td>
                <td>-</td>
                <td>${tInicio}</td><td>${tTermino}</td><td>${tFinal}</td><td>${tVigentes}</td>
                <td>+${tIngresos}</td><td>-${tFiniquitos}</td><td>${tLicencia}</td>
                <td>${tMod}</td><td>${tMoi}</td><td>${tHombres}</td><td>${tMujeres}</td>
                <td style="color: ${tVariacion >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
                    ${tVariacion > 0 ? '+' : ''}${tVariacion.toFixed(2)}%
                </td>
                <td></td>
            </tr>
        `;


        // Show KPI cards and table immediately
        statsContainer.innerHTML = `
            <div class="stat-card blue"><div class="stat-title">Dotación Inicial</div><div class="stat-value">${tInicio}</div></div>
            <div class="stat-card green"><div class="stat-title">Ingresos Acumulados</div><div class="stat-value">+${tIngresos}</div></div>
            <div class="stat-card red"><div class="stat-title">Finiquitos Acumulados</div><div class="stat-value">-${tFiniquitos}</div></div>
            <div class="stat-card yellow"><div class="stat-title">Licencias Médicas</div><div class="stat-value">${tLicencia}</div></div>
        `;

        // Defer heavy chart rendering so UI never freezes
        const renderTurnos = () => {
            const turnosTbody = document.getElementById('turnos-tbody');
            const turnosTfoot = document.getElementById('turnos-tfoot');
            if (!turnosTbody) return;
            turnosTbody.innerHTML = '';
            const turnosGrouped = {};
            latestData.forEach(stat => {
                const proj = stat.proyecto;
                if (!turnosGrouped[proj]) turnosGrouped[proj] = {
                    mod: { '04X03':0,'05X02':0,'06X01':0,'07X07':0,'08X06':0,'14X14':0,'15X13':0,'21X07':0 },
                    moi: { '04X03':0,'05X02':0,'06X01':0,'07X07':0,'08X06':0,'14X14':0,'15X13':0,'21X07':0 }
                };
                if (stat.turnos_mod) {
                    Object.keys(stat.turnos_mod).forEach(k => turnosGrouped[proj].mod[k] += stat.turnos_mod[k]);
                    Object.keys(stat.turnos_moi).forEach(k => turnosGrouped[proj].moi[k] += stat.turnos_moi[k]);
                }
            });
            const keys = ['04X03','05X02','06X01','07X07','08X06','14X14','15X13','21X07'];
            let modHtml = `<tr><td colspan="10" style="background:var(--secondary);color:white;font-weight:bold;text-align:center;">MOD</td></tr>`;
            let totalMod = {}; keys.forEach(k => totalMod[k] = 0);
            Object.keys(turnosGrouped).forEach(proj => {
                const mod = turnosGrouped[proj].mod;
                let rowTotal = 0; let tds = '';
                keys.forEach(k => { const v=mod[k]||0; totalMod[k]+=v; rowTotal+=v; tds+=`<td>${v>0?v:''}</td>`; });
                if (rowTotal > 0) modHtml += `<tr><td style="font-weight:600;text-align:left;">${proj}</td>${tds}<td style="font-weight:bold;">${rowTotal}</td></tr>`;
            });
            let tModTds=''; let tModGrand=0;
            keys.forEach(k => { tModTds+=`<td>${totalMod[k]>0?totalMod[k]:''}</td>`; tModGrand+=totalMod[k]; });
            modHtml += `<tr style="background:#F1F5F9;font-weight:bold;"><td style="text-align:center;">Total MOD</td>${tModTds}<td>${tModGrand}</td></tr>`;
            let moiHtml = `<tr><td colspan="10" style="background:var(--primary);color:white;font-weight:bold;text-align:center;">MOI</td></tr>`;
            let totalMoi = {}; keys.forEach(k => totalMoi[k] = 0);
            Object.keys(turnosGrouped).forEach(proj => {
                const moi = turnosGrouped[proj].moi;
                let rowTotal = 0; let tds = '';
                keys.forEach(k => { const v=moi[k]||0; totalMoi[k]+=v; rowTotal+=v; tds+=`<td>${v>0?v:''}</td>`; });
                if (rowTotal > 0) moiHtml += `<tr><td style="font-weight:600;text-align:left;">${proj}</td>${tds}<td style="font-weight:bold;">${rowTotal}</td></tr>`;
            });
            let tMoiTds=''; let tMoiGrand=0;
            keys.forEach(k => { tMoiTds+=`<td>${totalMoi[k]>0?totalMoi[k]:''}</td>`; tMoiGrand+=totalMoi[k]; });
            moiHtml += `<tr style="background:#F1F5F9;font-weight:bold;"><td style="text-align:center;">Total MOI</td>${tMoiTds}<td>${tMoiGrand}</td></tr>`;
            turnosTbody.innerHTML = modHtml + moiHtml;
            let grandHtml = `<tr style="background:var(--warning-bg);font-weight:bold;color:var(--primary);"><td style="text-align:left;">Total general</td>`;
            let superGrand = 0;
            keys.forEach(k => { const s=totalMod[k]+totalMoi[k]; superGrand+=s; grandHtml+=`<td>${s>0?s:''}</td>`; });
            grandHtml += `<td>${superGrand}</td></tr>`;
            if (turnosTfoot) turnosTfoot.innerHTML = grandHtml;
        };

        // Shared label plugin for distribution charts
        const rawDataLabelsPlugin = {
            id: 'rawDataLabelsPlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart; ctx.save();
                ctx.font = 'bold 13px var(--font-body)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'white';
                chart.data.datasets.forEach((dataset, i) => {
                    if (!chart.isDatasetVisible(i)) return;
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const rawVal = dataset.rawValues ? dataset.rawValues[index] : null;
                        if (rawVal > 0) ctx.fillText(rawVal, bar.x - (bar.width / 2), bar.y);
                    });
                }); ctx.restore();
            }
        };

        const commonStackedOptions = {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'var(--font-body)', size: 13 }, usePointStyle: true, padding: 20 } },
                tooltip: { callbacks: { label(ctx) { const r = ctx.dataset.rawValues?.[ctx.dataIndex]; return `${ctx.dataset.label}: ${r??''} (${ctx.raw.toFixed(1)}%)`; } }, backgroundColor: 'rgba(15,23,42,0.9)', padding: 12, cornerRadius: 8 }
            },
            scales: {
                x: { stacked: true, max: 100, ticks: { callback: v => v+'%', font: { family: 'var(--font-body)', size: 12 }, color: '#64748b' }, grid: { color: '#f1f5f9', borderDash: [4,4] } },
                y: { stacked: true, grid: { display: false }, ticks: { font: { family: 'var(--font-body)', size: 12 }, color: '#64748b' } }
            }
        };

        const renderBalance = () => {
            const ctx = document.getElementById('balanceChart');
            if (!ctx) return;
            const cg = {};
            latestData.forEach(s => { if (!cg[s.proyecto]) cg[s.proyecto]={inicio:0,termino:0}; cg[s.proyecto].inicio+=s.dotInicio; cg[s.proyecto].termino+=s.dotTermino; });
            const sorted = Object.keys(cg).sort((a,b) => cg[b].inicio-cg[a].inicio);
            const balWrapper = document.getElementById('balanceChartWrapper');
            if (balWrapper) balWrapper.style.width = Math.max(balWrapper.parentElement.clientWidth, sorted.length*60)+'px';
            if (window.balanceChartInstance) window.balanceChartInstance.destroy();
            const dataLabelsPlugin = { id:'balDataLabels', afterDatasetsDraw(chart) {
                const {ctx}=chart; ctx.save(); ctx.font='11px var(--font-body)'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillStyle='#64748b';
                chart.data.datasets.forEach((ds,i) => { const meta=chart.getDatasetMeta(i); meta.data.forEach((bar,idx) => { if(ds.data[idx]>0) ctx.fillText(ds.data[idx],bar.x,bar.y-4); }); });
                ctx.restore();
            }};
            window.balanceChartInstance = new Chart(ctx, { type:'bar', data:{ labels:sorted, datasets:[
                {label:'Dotación Inicio de Semana',data:sorted.map(p=>cg[p].inicio),backgroundColor:'#E63946',barPercentage:0.8,categoryPercentage:0.9,borderRadius:4},
                {label:'Dotación Término de Semana',data:sorted.map(p=>cg[p].termino),backgroundColor:'#1D3557',barPercentage:0.8,categoryPercentage:0.9,borderRadius:4}
            ]}, options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:20}}, plugins:{ legend:{position:'top',labels:{font:{family:'var(--font-body)',size:13},usePointStyle:true,padding:20}}, tooltip:{backgroundColor:'rgba(15,23,42,0.9)',padding:12,cornerRadius:8} }, scales:{ y:{beginAtZero:true,grid:{color:'#f1f5f9',borderDash:[4,4]},ticks:{font:{family:'var(--font-body)',size:12},color:'#64748b'}}, x:{grid:{display:false},ticks:{font:{family:'var(--font-body)',size:11},color:'#64748b',maxRotation:45,minRotation:45}} } }, plugins:[dataLabelsPlugin] });
        };

        const renderDistribucion = () => {
            const distCtx = document.getElementById('distribucionChart');
            const totalDistCtx = document.getElementById('totalDistribucionChart');
            if (!distCtx || !totalDistCtx) return;
            const dg = {}; let gMod=0, gMoi=0;
            latestData.forEach(s => { if(!dg[s.proyecto]) dg[s.proyecto]={mod:0,moi:0}; dg[s.proyecto].mod+=s.mod; dg[s.proyecto].moi+=s.moi; gMod+=s.mod; gMoi+=s.moi; });
            const sorted = Object.keys(dg).sort((a,b)=>(dg[b].mod+dg[b].moi)-(dg[a].mod+dg[a].moi));
            const modPcts=[], modRaws=[], moiPcts=[], moiRaws=[];
            sorted.forEach(p => { const t=dg[p].mod+dg[p].moi; modRaws.push(dg[p].mod); moiRaws.push(dg[p].moi); modPcts.push(t>0?(dg[p].mod/t)*100:0); moiPcts.push(t>0?(dg[p].moi/t)*100:0); });
            const dw = document.getElementById('distribucionChartWrapper');
            if (dw) dw.style.height = Math.max(500, sorted.length*40)+'px';
            if (window.distribucionChartInstance) window.distribucionChartInstance.destroy();
            window.distribucionChartInstance = new Chart(distCtx, { type:'bar', data:{ labels:sorted, datasets:[
                {label:'MOD',data:modPcts,rawValues:modRaws,backgroundColor:'#E63946',barPercentage:0.6,categoryPercentage:0.9},
                {label:'MOI',data:moiPcts,rawValues:moiRaws,backgroundColor:'#1D3557',barPercentage:0.6,categoryPercentage:0.9}
            ]}, options:commonStackedOptions, plugins:[rawDataLabelsPlugin] });
            const gt=gMod+gMoi, gModP=gt>0?(gMod/gt)*100:0, gMoiP=gt>0?(gMoi/gt)*100:0;
            const totalOpts = JSON.parse(JSON.stringify(commonStackedOptions)); totalOpts.scales.y.display=false;
            if (window.totalDistribucionChartInstance) window.totalDistribucionChartInstance.destroy();
            window.totalDistribucionChartInstance = new Chart(totalDistCtx, { type:'bar', data:{ labels:['Total'], datasets:[
                {label:'MOD',data:[gModP],rawValues:[gMod],backgroundColor:'#E63946',barPercentage:0.4},
                {label:'MOI',data:[gMoiP],rawValues:[gMoi],backgroundColor:'#1D3557',barPercentage:0.4}
            ]}, options:totalOpts, plugins:[rawDataLabelsPlugin] });
        };

        const renderGenero = () => {
            const genCtx = document.getElementById('generoChart');
            const totalGenCtx = document.getElementById('totalGeneroChart');
            if (!genCtx || !totalGenCtx) return;
            const gg = {}; let gFem=0, gMas=0;
            latestData.forEach(s => { if(!gg[s.proyecto]) gg[s.proyecto]={fem:0,mas:0}; gg[s.proyecto].fem+=s.mujeres; gg[s.proyecto].mas+=s.hombres; gFem+=s.mujeres; gMas+=s.hombres; });
            const sorted = Object.keys(gg).sort((a,b)=>(gg[b].fem+gg[b].mas)-(gg[a].fem+gg[a].mas));
            const femPcts=[], femRaws=[], masPcts=[], masRaws=[];
            sorted.forEach(p => { const t=gg[p].fem+gg[p].mas; femRaws.push(gg[p].fem); masRaws.push(gg[p].mas); femPcts.push(t>0?(gg[p].fem/t)*100:0); masPcts.push(t>0?(gg[p].mas/t)*100:0); });
            const gw = document.getElementById('generoChartWrapper');
            if (gw) gw.style.height = Math.max(500, sorted.length*40)+'px';
            const genOpts = JSON.parse(JSON.stringify(commonStackedOptions)); genOpts.scales.y.display=true;
            if (window.generoChartInstance) window.generoChartInstance.destroy();
            window.generoChartInstance = new Chart(genCtx, { type:'bar', data:{ labels:sorted, datasets:[
                {label:'F',data:femPcts,rawValues:femRaws,backgroundColor:'#1D3557',barPercentage:0.6,categoryPercentage:0.9},
                {label:'M',data:masPcts,rawValues:masRaws,backgroundColor:'#E63946',barPercentage:0.6,categoryPercentage:0.9}
            ]}, options:genOpts, plugins:[rawDataLabelsPlugin] });
            const gt2=gFem+gMas, gFP=gt2>0?(gFem/gt2)*100:0, gMP=gt2>0?(gMas/gt2)*100:0;
            const tgo = JSON.parse(JSON.stringify(genOpts)); tgo.scales.y.display=false;
            if (window.totalGeneroChartInstance) window.totalGeneroChartInstance.destroy();
            window.totalGeneroChartInstance = new Chart(totalGenCtx, { type:'bar', data:{ labels:['Total'], datasets:[
                {label:'F',data:[gFP],rawValues:[gFem],backgroundColor:'#1D3557',barPercentage:0.4},
                {label:'M',data:[gMP],rawValues:[gMas],backgroundColor:'#E63946',barPercentage:0.4}
            ]}, options:tgo, plugins:[rawDataLabelsPlugin] });
        };

        const renderHistorico = () => {
            const histCtx = document.getElementById('historicoChart');
            if (!histCtx) return;
            const allStats = Object.values(globalSummaryData);
            const dateSet = new Set();
            allStats.forEach(s => { if(s.semanaDate) dateSet.add(s.semanaDate); });
            const sortedDates = Array.from(dateSet).sort();
            const xLabels = sortedDates.map(d => { const p=d.split('-'); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d; });
            const projectSeries = {};
            allStats.forEach(s => { if(!projectSeries[s.proyecto]) projectSeries[s.proyecto]={}; if(s.semanaDate) projectSeries[s.proyecto][s.semanaDate]=s.dotFinal; });
            const palette=['#E63946','#1D3557','#F4A261','#2A9D8F','#E9C46A','#264653','#8AB17D','#B5838D','#E5989B','#FFB703','#FB8500','#023047','#219EBC','#8ECAE6','#FF006E','#8338EC','#3A0CA3','#4361EE'];
            let ci=0;
            const numProjects = Object.keys(projectSeries).length;
            const histDatasets = Object.keys(projectSeries).sort().map(proj => {
                const color=palette[ci++%palette.length];
                return {
                    label: proj,
                    data: sortedDates.map(d=>projectSeries[proj][d]??null),
                    borderColor: color, backgroundColor: color,
                    tension: 0.3, fill: false, borderWidth: 2.5,
                    pointRadius: 6, pointHoverRadius: 9,
                    pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2,
                    spanGaps: true
                };
            });
            // Dynamic chart height: more projects = taller chart to fit bottom legend
            const legendRows = Math.ceil(numProjects / 3);
            const chartHeight = Math.max(500, 350 + legendRows * 28);
            const hw = document.getElementById('historicoChartWrapper');
            if (hw) {
                hw.style.height = chartHeight + 'px';
                hw.style.width = Math.max(hw.parentElement.clientWidth, Math.max(xLabels.length, 2) * 120) + 'px';
            }
            if (window.historicoChartInstance) window.historicoChartInstance.destroy();
            window.historicoChartInstance = new Chart(histCtx, {
                type:'line',
                data:{ labels:xLabels, datasets:histDatasets },
                options:{
                    responsive:true, maintainAspectRatio:false,
                    layout:{ padding:{ top:24, right:16, bottom:8, left:8 } },
                    plugins:{
                        legend:{
                            position:'bottom',
                            labels:{
                                font:{ family:'var(--font-body)', size:12 },
                                usePointStyle:true, pointStyleWidth:12,
                                padding:16,
                                // No maxWidth so full names always show
                                generateLabels(chart) {
                                    return chart.data.datasets.map((ds, i) => ({
                                        text: ds.label,
                                        fillStyle: ds.borderColor,
                                        strokeStyle: ds.borderColor,
                                        pointStyle: 'circle',
                                        hidden: !chart.isDatasetVisible(i),
                                        datasetIndex: i
                                    }));
                                }
                            }
                        },
                        tooltip:{
                            mode:'index', intersect:false,
                            backgroundColor:'rgba(15,23,42,0.92)',
                            titleFont:{ family:'var(--font-heading)', size:13 },
                            bodyFont:{ family:'var(--font-body)', size:12 },
                            padding:14, cornerRadius:10,
                            callbacks:{
                                label(ctx) { return ctx.parsed.y != null ? ` ${ctx.dataset.label}: ${ctx.parsed.y} personas` : null; }
                            }
                        }
                    },
                    scales:{
                        y:{ beginAtZero:true, grid:{color:'#f1f5f9',borderDash:[4,4]}, ticks:{font:{family:'var(--font-body)',size:12},color:'#64748b'} },
                        x:{ grid:{display:false}, ticks:{font:{family:'var(--font-body)',size:12},color:'#64748b',maxRotation:30,minRotation:0} }
                    }
                },
                plugins:[{ id:'histLabels', afterDatasetsDraw(chart) {
                    const{ctx}=chart; ctx.save();
                    ctx.font='bold 11px var(--font-body)'; ctx.textAlign='center'; ctx.textBaseline='bottom';
                    chart.data.datasets.forEach((ds,i) => {
                        if(!chart.isDatasetVisible(i)) return;
                        const meta=chart.getDatasetMeta(i);
                        meta.data.forEach((pt,idx) => {
                            const v=ds.data[idx];
                            if(v!=null && v>0){
                                ctx.fillStyle=ds.borderColor;
                                // Offset alternating labels so they don't overlap on same date
                                const offset = (i % 2 === 0) ? -14 : 3;
                                ctx.fillText(v, pt.x, pt.y + offset);
                            }
                        });
                    });
                    ctx.restore();
                }}]
            });
        };

        // Fire charts one by one after the table is painted
        deferredRender(renderTurnos)
            .then(() => deferredRender(renderBalance))
            .then(() => deferredRender(renderDistribucion))
            .then(() => deferredRender(renderGenero))
            .then(() => deferredRender(renderHistorico));
    }

    document.getElementById('export-summary').addEventListener('click', () => {
        let data = Object.values(globalSummaryData);
        
        // Ordenar por fecha descendente
        data.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

        // Tomar SIEMPRE SOLO el último periodo subido (máximo global)
        let latestData = [];
        if (data.length > 0) {
            const maxIsoDate = data[0].isoDate;
            latestData = data.filter(stat => stat.isoDate === maxIsoDate);
        }

        if (latestData.length > 0) {
            const dataToExport = latestData.map(stat => ({
                "SEMANA": stat.fechaSemana || stat.isoDate || "N/A",
                "PROYECTO": stat.proyecto,
                "DOTACIÓN INICIO SEMANA": stat.dotInicio,
                "DOTACIÓN TÉRMINO SEMANA": stat.dotTermino,
                "DOTACIÓN FINAL DE LA SEMANA": stat.dotFinal,
                "VIGENTES DEL PERIODO": stat.vigentes,
                "INGRESOS DEL PERIODO": stat.ingresos,
                "FINIQUITOS DEL PERIODO": stat.finiquitos,
                "PERSONAL LICENCIA MÉDICA": stat.licencia,
                "PERSONAL MOD": stat.mod,
                "PERSONAL MOI": stat.moi,
                "PERSONAL MASCULINO": stat.hombres,
                "PERSONAL FEMENINO": stat.mujeres,
                "VARIACIÓN": ((stat.dotInicio > 0 ? ((stat.dotTermino - stat.dotInicio) / stat.dotInicio) : 0) * 100).toFixed(2) + '%'
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cuadro Resumen Acumulado");
            XLSX.writeFile(wb, "Resumen_General_Dotacion.xlsx");
        } else {
            alert("No hay datos para exportar con los filtros actuales.");
        }
    });

    // ==========================================
    // EXPORT / IMPORT DATABASE (JSON)
    // ==========================================
    
    document.getElementById('btn-export-db').addEventListener('click', async () => {
        try {
            const allRecords = await loadAllFromDB();
            if (allRecords.length === 0) {
                alert("La base de datos está vacía. No hay nada que exportar.");
                return;
            }
            const jsonString = JSON.stringify(allRecords, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `AdmPersonas_Backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error al exportar:", error);
            alert("Hubo un error al exportar la base de datos.");
        }
    });

    const btnImport = document.getElementById('btn-import-db');
    const inputImport = document.getElementById('input-import-db');
    
    if (btnImport && inputImport) {
        btnImport.addEventListener('click', () => {
            inputImport.click();
        });

        inputImport.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    let data = JSON.parse(event.target.result);
                    // Si por algún motivo era un objeto (diccionario) en vez de array, lo convertimos
                    if (data && !Array.isArray(data) && typeof data === 'object') {
                        data = Object.values(data);
                    }
                    if (!Array.isArray(data)) {
                        throw new Error("El archivo no tiene el formato correcto (debe ser un array de registros).");
                    }
                    
                    let successCount = 0;
                    for (const record of data) {
                        if (record.proyecto) {
                            if (!record.id) {
                                record.id = `${record.proyecto}_${record.isoDate || record.semanaDate || Date.now()}`; 
                            }
                            try {
                                await saveProjectsToDB([record]);
                                successCount++;
                            } catch (err) {
                                console.warn("No se pudo guardar el registro:", record, err);
                            }
                        }
                    }
                    alert(`¡Backup importado exitosamente! Se cargaron ${successCount} registros.`);
                    inputImport.value = ''; 
                    
                    const newData = await loadAllFromDB();
                    globalSummaryData = {};
                    newData.forEach(stat => {
                        globalSummaryData[stat.id] = stat;
                    });
                    renderSummary();
                    if (!document.querySelector('.upload-section').style.display || document.querySelector('.upload-section').style.display === 'none') {
                        document.getElementById('btn-historial').click();
                    }
                } catch (error) {
                    console.error("Error importando:", error);
                    alert("Error al importar el archivo JSON: " + error.message);
                }
            };
            reader.readAsText(file);
        });
    }

    document.getElementById('btn-filter')?.addEventListener('click', renderSummary);
});
