# app.py (الواجهة الخلفية باستخدام Flask - النسخة النهائية والمعدلة)

from flask import Flask, jsonify, request, render_template
import json
import os
from datetime import datetime
from flask_cors import CORS 
from waitress import serve # 🌟 تم نقل الاستيراد للأعلى للتنظيم

# ----------------------------------------------------------------
# 1. تعريف التطبيق وتكوين المسارات (الحل لـ TemplateNotFound)
# ----------------------------------------------------------------
# Flask سيبحث عن index.html في مجلد 'templates' وعن style.css في مجلد 'static'
app = Flask(__name__, template_folder='templates', static_folder='static') 
CORS(app) 

# الثوابت
DATA_FILE = 'data.json'
DEFAULT_PROFILE_PIC = 'default.png' 

# ----------------------------------------------------------------
# 2. دوال مساعدة لإدارة ملف JSON
# ----------------------------------------------------------------

def load_data():
    """تحميل البيانات من ملف JSON."""
    if not os.path.exists(DATA_FILE):
        # تهيئة البيانات الافتراضية إذا كان الملف غير موجود
        static_users = [
            {
                "uid": "ali_123",
                "username": "ali",
                "fullName": "علي الطائي",
                "password": "aaaaaa",
                "description": "المستخدم الأول (علي)",
                "photoURL": '/static/' + DEFAULT_PROFILE_PIC # مسار الصورة
            },
            {
                "uid": "athraa_456",
                "username": "athraa",
                "fullName": "sajad",
                "password": "aaaaaa",
                "description": "المستخدم الثاني (سجاد)",
                "photoURL": '/static/' + DEFAULT_PROFILE_PIC # مسار الصورة
            }
        ]
        
        initial_chat_id = "ali_123_athraa_456"
        initial_chats = {
            initial_chat_id: [
                {"senderId": "ali_123", "recipientId": "athraa_456", "content": "السلام عليكم! هذا مشروعنا البايثون.", "type": "text", "timestamp": datetime.now().isoformat()},
                {"senderId": "athraa_456", "recipientId": "ali_123", "content": "وعليكم السلام! عظيم، سأرى هذه الرسالة حتى بعد التحديث.", "type": "text", "timestamp": datetime.now().isoformat()}
            ]
        }
        
        data = {"users": static_users, "chats": initial_chats}
        save_data(data)
        return data
    
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    """حفظ البيانات في ملف JSON."""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_chat_id(id1, id2):
    """إنشاء معرف ثابت للمحادثة (مرتب أبجديًا)."""
    return '_'.join(sorted([id1, id2]))

# ----------------------------------------------------------------
# 3. نقاط نهاية API
# ----------------------------------------------------------------

@app.route('/')
def serve_index():
    """تقديم ملف index.html. يجب أن يجده Flask الآن في مجلد templates."""
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    """التحقق من بيانات الدخول الثابتة."""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_data()
    user = next((u for u in db['users'] if u['username'] == username and u['password'] == password), None)
    
    if user:
        # إرجاع بيانات المستخدم (باستثناء كلمة السر) والطرف الآخر
        opponent = next((u for u in db['users'] if u['uid'] != user['uid']), None)
        return jsonify({"success": True, "user": user, "opponent": opponent})
    else:
        return jsonify({"success": False, "message": "اسم المستخدم أو كلمة السر غير صحيحة."}), 401

@app.route('/messages', methods=['GET'])
def get_messages():
    """جلب جميع الرسائل لمحادثة معينة."""
    my_id = request.args.get('myId')
    recipient_id = request.args.get('recipientId')
    
    if not my_id or not recipient_id:
        return jsonify({"error": "معرفات المستخدمين مطلوبة."}), 400
    
    chat_id = get_chat_id(my_id, recipient_id)
    db = load_data()
    messages = db['chats'].get(chat_id, [])
    
    return jsonify({"messages": messages})

@app.route('/send', methods=['POST'])
def send_message():
    """حفظ رسالة جديدة في ملف JSON."""
    data = request.json
    sender_id = data.get('senderId')
    recipient_id = data.get('recipientId')
    content = data.get('content')
    msg_type = data.get('type')
    
    if not all([sender_id, recipient_id, content]):
        return jsonify({"error": "بيانات الرسالة مفقودة."}), 400
        
    chat_id = get_chat_id(sender_id, recipient_id)
    db = load_data()
    
    if chat_id not in db['chats']:
        db['chats'][chat_id] = []
        
    new_message = {
        "senderId": sender_id,
        "recipientId": recipient_id,
        "content": content,
        "type": msg_type,
        "timestamp": datetime.now().isoformat() # وقت الإرسال الحقيقي
    }
    
    db['chats'][chat_id].append(new_message)
    save_data(db)
    
    return jsonify({"success": True, "message": new_message})

# ----------------------------------------------------------------
# 4. تشغيل الخادم
# ----------------------------------------------------------------
if __name__ == '__main__':
    print("سيرفر Waitress قيد التشغيل: http://127.0.0.1:5000/")

    # استخدام Waitress لحل مشكلة /dev/shm
    server(app, host='0.0.0.0', port=5000)
