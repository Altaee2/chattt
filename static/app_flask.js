// app_flask.js (الواجهة الأمامية تتواصل مع خادم Flask)

const API_BASE_URL = 'http://127.0.0.1:5000'; // عنوان خادم Flask

// ----------------------------------------------------------------
// 1. المتغيرات والدوال المساعدة
// ----------------------------------------------------------------

let currentUser = null;
let currentRecipient = null;

// عناصر DOM
const loadingSplash = document.getElementById('loading-splash');
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const authForm = document.getElementById('auth-form');
const usernameLogin = document.getElementById('username-login');
const passwordLogin = document.getElementById('password-login');
const conversationList = document.getElementById('conversation-list');
const messagesArea = document.getElementById('messages-area');
const logoutBtn = document.getElementById('logout-btn');
const likeBtn = document.getElementById('like-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const attachBtn = document.getElementById('attach-btn');
const mediaInput = document.getElementById('media-input');
const backToChatsBtn = document.getElementById('back-to-chats-btn');

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// ----------------------------------------------------------------
// 2. إدارة حالة المستخدم والمصادقة
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // محاكاة التحقق من الجلسة (في المشروع الحقيقي نستخدم Token)
    const storedUser = localStorage.getItem('flaskCurrentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        // بما أننا نعرف أن هناك مستخدمين فقط، نجلب الطرف الآخر
        loginSuccess(currentUser, JSON.parse(localStorage.getItem('flaskCurrentRecipient')));
    } else {
        setTimeout(checkAuthState, 500);
    }
});

function checkAuthState() {
    loadingSplash.classList.remove('active');
    loadingSplash.classList.add('hidden');
    
    if (currentUser) {
        authContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
    } else {
        chatContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
    }
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameLogin.value.toLowerCase();
    const password = passwordLogin.value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // حفظ بيانات المستخدم والطرف الآخر محليًا
            currentUser = result.user;
            const recipient = result.opponent;

            localStorage.setItem('flaskCurrentUser', JSON.stringify(currentUser));
            localStorage.setItem('flaskCurrentRecipient', JSON.stringify(recipient));

            loginSuccess(currentUser, recipient);
        } else {
            alert(`خطأ في الدخول: ${result.message}`);
        }
    } catch (error) {
        alert('حدث خطأ في الاتصال بالخادم. تأكد من تشغيل app.py.');
        console.error('Login Error:', error);
    }
});

function loginSuccess(user, recipientData) {
    // تحديث الواجهة
    document.getElementById('my-username').textContent = user.fullName;
    document.getElementById('my-profile-pic').src = user.photoURL;

    // عرض الطرف الآخر في القائمة الجانبية
    displayOpponent(recipientData);
    
    checkAuthState();
}

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('flaskCurrentUser');
    localStorage.removeItem('flaskCurrentRecipient');
    currentUser = null;
    currentRecipient = null;
    checkAuthState();
});

function displayOpponent(recipientData) {
    currentRecipient = recipientData;
    conversationList.innerHTML = '';
    
    const li = document.createElement('li');
    li.classList.add('active'); 
    li.innerHTML = `
        <img src="${recipientData.photoURL}" alt="صورة" class="profile-thumb">
        <div>
            <span>${recipientData.fullName}</span>
            <span style="font-size:0.8em; color:#999;">${recipientData.description}</span>
        </div>
    `;
    li.onclick = () => startChat(recipientData);
    conversationList.appendChild(li);
    
    startChat(recipientData);
}

// ----------------------------------------------------------------
// 3. منطق الدردشة (الاتصال بالـ API)
// ----------------------------------------------------------------

function startChat(recipientData) {
    document.getElementById('recipient-name').textContent = recipientData.fullName;
    document.getElementById('recipient-profile-pic').src = recipientData.photoURL;
    document.getElementById('chat-header').querySelector('.recipient-info').lastElementChild.textContent = recipientData.description;

    messageInput.disabled = false;
    sendBtn.disabled = false;
    
    loadMessages();
    
    if (window.innerWidth <= 768) {
        chatContainer.classList.add('chat-active-mobile');
    }
}

backToChatsBtn.addEventListener('click', () => {
    chatContainer.classList.remove('chat-active-mobile');
});

async function loadMessages() {
    messagesArea.innerHTML = '';
    document.getElementById('chat-placeholder').classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/messages?myId=${currentUser.uid}&recipientId=${currentRecipient.uid}`);
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('chat-placeholder').classList.add('hidden');
            result.messages.forEach(msg => displayMessage(msg));
            messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
             messagesArea.innerHTML = '<p style="color:red;">فشل جلب الرسائل.</p>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesArea.innerHTML = '<p style="color:red;">لا يمكن الاتصال بالخادم.</p>';
    }
}

async function sendMessage(content, type) {
    const messageData = {
        senderId: currentUser.uid,
        recipientId: currentRecipient.uid,
        content: content,
        type: type
    };

    try {
        const response = await fetch(`${API_BASE_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // عرض الرسالة التي أرجعها الخادم (تضمن الوقت الحقيقي والحفظ)
            displayMessage(result.message);
            messageInput.value = '';
            messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
            alert(`فشل الإرسال: ${result.message || 'حدث خطأ في الخادم.'}`);
        }
    } catch (error) {
        console.error('Send Error:', error);
        alert('فشل إرسال الرسالة. تأكد من اتصالك.');
    }
}

// ----------------------------------------------------------------
// 4. عرض الرسائل والوسائط
// ----------------------------------------------------------------

function displayMessage(message) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper');
    wrapper.style.justifyContent = (message.senderId === currentUser.uid) ? 'flex-end' : 'flex-start';

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const isSent = message.senderId === currentUser.uid;
    messageElement.classList.add(isSent ? 'sent' : 'received');

    let contentHTML = '';
    
    if (message.type === 'text') {
        contentHTML = `<p>${message.content}</p>`;
    } else if (message.type === 'image_base64' && message.content) {
        // يتم عرض الصورة عبر Base64 المخزن
        contentHTML = `<img src="${message.content}" alt="صورة" style="max-width: 100%; border-radius: 5px; cursor: pointer;">`;
        messageElement.style.backgroundColor = 'transparent'; 
        messageElement.style.padding = '5px';
    } else if (message.type === 'like') {
        messageElement.classList.add('like');
        contentHTML = `<span style="color: #e74c3c;">${message.content}</span>`;
    } 
    
    const timeHtml = message.timestamp ? `<span class="message-time">${formatTime(message.timestamp)}</span>` : '';

    messageElement.innerHTML = contentHTML + timeHtml;

    wrapper.appendChild(messageElement);
    messagesArea.appendChild(wrapper);
}

// ----------------------------------------------------------------
// 5. معالجات الأزرار
// ----------------------------------------------------------------

sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text && currentRecipient) {
        sendMessage(text, 'text');
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
    }
});

likeBtn.addEventListener('click', () => {
    if (currentRecipient) {
        sendMessage('❤️', 'like');
    }
});

attachBtn.addEventListener('click', () => {
    if (currentRecipient) {
        mediaInput.click();
    }
});

mediaInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentRecipient) return;

    if (file.size > 500000) { 
        alert("لا يمكن إرسال هذا الملف. يرجى اختيار صورة أقل من 500 كيلوبايت.");
        mediaInput.value = '';
        return;
    }
    
    try {
        // تحويل الصورة إلى Base64 قبل الإرسال إلى الخادم
        const base64String = await fileToBase64(file);
        sendMessage(base64String, 'image_base64');
        
    } catch (error) {
        alert("فشل إرسال الملف.");
    } finally {
        mediaInput.value = ''; 
    }
});
