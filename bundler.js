/**
 * bundler.js
 * Скрипт для сохранения текущей страницы как единого HTML файла.
 * Очищает состояние (удаляет загруженные файлы из копии) перед сохранением.
 */

async function saveOfflineVersion() {
    const btn = document.querySelector('.btn-dark');
    const originalText = btn.innerText;
    btn.innerText = 'Bundling...';
    btn.disabled = true;

    try {
        // 1. Получаем текущий HTML как строку
        const currentHTML = document.documentElement.outerHTML;

        // 2. Создаем виртуальный DOM парсер, чтобы очистить HTML от данных пользователя
        // Это позволяет изменить сохраняемый файл, НЕ меняя то, что видит пользователь на экране.
        const parser = new DOMParser();
        const doc = parser.parseFromString(currentHTML, 'text/html');

        // --- ОЧИСТКА ИНТЕРФЕЙСА В ВИРТУАЛЬНОЙ КОПИИ ---
        
        // Очищаем панель источников (слева)
        const sourcesContainer = doc.getElementById('sources-container');
        if (sourcesContainer) {
            // Возвращаем исходное сообщение
            sourcesContainer.innerHTML = `
                <div style="text-align:center; color:#999; margin-top:20px;" id="empty-msg">
                    Upload PDF files or Images to start
                </div>
            `;
        }

        // Очищаем панель нового документа (справа)
        const newDocArea = doc.getElementById('new-doc-area');
        if (newDocArea) {
            newDocArea.innerHTML = '';
        }

        // Сбрасываем лоадер (если он вдруг активен)
        const loader = doc.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
        
        // Сбрасываем инпут файла
        const fileInput = doc.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
            fileInput.removeAttribute('value'); // На всякий случай
        }

        // Получаем "чистый" HTML строку из виртуального документа
        let htmlContent = doc.documentElement.outerHTML;

        // --- ДАЛЕЕ СТАНДАРТНАЯ ЛОГИКА ВСТРАИВАНИЯ БИБЛИОТЕК ---

        // 3. Список библиотек (ID должны совпадать с index.html)
        const libs = [
            { id: 'lib-pdflib', url: document.getElementById('lib-pdflib').src },
            { id: 'lib-pdfjs', url: document.getElementById('lib-pdfjs').src },
            { id: 'lib-sortable', url: document.getElementById('lib-sortable').src }
        ];

        // 4. Скачиваем и заменяем скрипты
        for (const lib of libs) {
            const response = await fetch(lib.url);
            if (!response.ok) throw new Error(`Failed to fetch ${lib.url}`);
            
            let scriptContent = await response.text();
            
            // Экранируем закрывающий тег script
            scriptContent = scriptContent.replace(/<\/script>/g, '<\\/script>');
            
            // Регулярное выражение для поиска тега
            const regex = new RegExp(`<script id="${lib.id}"[^>]*>.*?<\/script>`, 's');
            
            // Заменяем (используем функцию-стрелку для безопасности спецсимволов $)
            htmlContent = htmlContent.replace(regex, () => `<script>${scriptContent}</script>`);
        }

        // 5. Обработка PDF.js Worker
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const workerResponse = await fetch(workerUrl);
        let workerCode = await workerResponse.text();
        
        const workerSetupScript = `
        <script>
            (function() {
                try {
                    const workerCode = ${JSON.stringify(workerCode)};
                    const blob = new Blob([workerCode], { type: 'text/javascript' });
                    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
                    console.log("Offline worker initialized");
                } catch(e) {
                    console.error("Worker init failed", e);
                }
            })();
        </script>
        `;
        
        htmlContent = htmlContent.replace('</body>', () => `${workerSetupScript}</body>`);

        // 6. Удаляем сам скрипт bundler.js из финального файла
        htmlContent = htmlContent.replace(/<script src="bundler\.js"><\/script>/, '');

        // 7. Скачиваем результат
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pdf_merge_offline.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error(err);
        alert('Error creating offline bundle: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}