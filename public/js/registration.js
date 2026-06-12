document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');

    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(registrationForm);
            const data = Object.fromEntries(formData);

            // Показываем загрузку
            const submitBtn = registrationForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.querySelector('p').textContent;
            submitBtn.querySelector('p').textContent = 'Отправка...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    // Показываем модальное окно
                    showVerificationModal(result.email);
                    registrationForm.reset();
                } else {
                    const errorDiv = document.getElementById('formError');
                    errorDiv.textContent = result.message;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);
                }
            } catch (error) {
                console.error('Ошибка:', error);
                const errorDiv = document.getElementById('formError');
                errorDiv.textContent = 'Произошла ошибка. Попробуйте позже.';
                errorDiv.style.display = 'block';
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, 3000);
            } finally {
                submitBtn.querySelector('p').textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

function showVerificationModal(email) {
    // Удаляем старый модал, если есть
    const existingModal = document.getElementById('verificationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Создаем модальное окно
    const modalHTML = `
        <div id="verificationModal" class="modal-overlay">
            <div class="modal-content">
                <span class="close-modal" onclick="closeModal()">&times;</span>
                <p class="modal-text">
                    Код подтверждения отправлен на почту<br>
                    <strong>${email}</strong>
                </p>
                
                <div id="modalMessage" class="modal-message"></div>
                
                <div class="dl_input">
                    <input type="text" id="verificationCode" class="poleaa" placeholder="000000" maxlength="6" pattern="\\d{6}" autofocus>
                </div>

                <div class="dlon">
                    <button onclick="verifyCode('${email}')" class="karti">Подтвердить</button>
                    <button onclick="resendCode('${email}')" class="resend-btn">Отправить код повторно</button>
                </div>

                <div class="timer" id="timer">10:00</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    addModalStyles();
    startTimer(600);

    // Закрытие по клику на оверлей
    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.querySelector('.modal-overlay')) {
            closeModal();
        }
    });

    // Обработка Enter
    document.getElementById('verificationCode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyCode(email);
        }
    });
}

function addModalStyles() {
    if (document.getElementById('modalStyles')) return;

    const styles = `
        <style id="modalStyles">
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            }
            
            .modal-content {
                background: #FFF3DF;
                border-radius: 30px;
                padding: 30px;
                max-width: 454px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease-out;
                position: relative;
                border: 4px solid #80191B;
            }
            
            .close-modal {
                position: absolute;
                top: 15px;
                right: 20px;
                font-size: 28px;
                cursor: pointer;
                color: #80191B;
                transition: color 0.3s;
            }
            
            .close-modal:hover {
                color: #DAA655;
                transform: scale(1.1);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from {
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .modal-text {
                font-size: 24px;
                color: #80191B;
                margin-bottom: 20px;
                font-weight: 600;
            }
            
            .modal-message {
                margin-bottom: 20px;
                padding: 10px;
                border-radius: 8px;
                display: none;
            }
            
            .modal-message.success {
                display: block;
                background: #e8f5e9;
                color: #2e7d32;
                border-left: 4px solid #2e7d32;
            }
            
            .modal-message.error {
                display: block;
                background: #ffebee;
                color: #c62828;
                border-left: 4px solid #c62828;
            }
            
            .dl_input {
                margin-bottom: 20px;
            }
            
            .poleaa {
                text-align: center;
                background-color: #FFF3DF;
                border: 2px solid #80191B;
                border-radius: 15px;
                font-family: 'Montserrat', sans-serif;
                font-size: 34px;
                color: #80191B;
                font-weight: 600;
                outline: none;
                padding: 15px;
                width: 200px;
                letter-spacing: 5px;
            }
            
            .dlon {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .karti {
                background-color: #80191B;
                color: white;
                padding: 12px 30px;
                border: none;
                border-radius: 20px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .karti:hover {
                transform: scale(0.95);
                background-color: #DAA655;
                color: #80191B;
            }
            
            .resend-btn {
                background: none;
                border: none;
                color: #80191B;
                cursor: pointer;
                font-size: 14px;
                text-decoration: underline;
                font-family: 'Montserrat', sans-serif;
                margin-bottom: 15px;
            }
            
            .resend-btn:hover {
                color: #DAA655;
            }
            
            .timer {
                font-size: 14px;
                color: #80191B;
                font-family: monospace;
                margin-top: 10px;
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

let timerInterval = null;

function startTimer(seconds) {
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    if (timerInterval) clearInterval(timerInterval);

    let remaining = seconds;

    timerInterval = setInterval(() => {
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerElement.textContent = 'Код истек. Запросите новый';
            timerElement.style.color = '#c62828';
        }
        remaining--;
    }, 1000);
}

async function verifyCode(email) {
    const codeInput = document.getElementById('verificationCode');
    const code = codeInput.value.trim();
    const messageDiv = document.getElementById('modalMessage');
    const verifyBtn = document.querySelector('.karti');

    if (!code || code.length !== 6) {
        showModalMessage('Пожалуйста, введите 6-значный код', 'error');
        return;
    }

    verifyBtn.textContent = 'Проверка...';
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/auth/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const result = await response.json();

        if (result.success) {
            showModalMessage(result.message, 'success');
            setTimeout(() => {
                window.location.href = result.redirect;
            }, 1500);
        } else {
            showModalMessage(result.message, 'error');
            verifyBtn.textContent = 'Подтвердить';
            verifyBtn.disabled = false;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showModalMessage('Произошла ошибка. Попробуйте позже.', 'error');
        verifyBtn.textContent = 'Подтвердить';
        verifyBtn.disabled = false;
    }
}

async function resendCode(email) {
    const resendBtn = document.querySelector('.resend-btn');
    const originalText = resendBtn.textContent;

    resendBtn.textContent = 'Отправка...';
    resendBtn.disabled = true;

    try {
        const response = await fetch('/auth/resend-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (result.success) {
            showModalMessage(result.message, 'success');
            // Перезапускаем таймер
            if (timerInterval) clearInterval(timerInterval);
            startTimer(600);
            // Очищаем поле ввода
            document.getElementById('verificationCode').value = '';
        } else {
            showModalMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showModalMessage('Не удалось отправить код', 'error');
    } finally {
        resendBtn.textContent = originalText;
        resendBtn.disabled = false;
    }
}

function showModalMessage(message, type) {
    const messageDiv = document.getElementById('modalMessage');
    messageDiv.textContent = message;
    messageDiv.className = `modal-message ${type}`;

    setTimeout(() => {
        messageDiv.className = 'modal-message';
        messageDiv.textContent = '';
    }, 3000);
}

function closeModal() {
    const modal = document.getElementById('verificationModal');
    if (modal) {
        modal.remove();
    }
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}