# auth_extension.py (trecho a integrar ao seu bot existente)
import sqlite3, secrets, time
from datetime import datetime, timedelta

DB_PATH = "bot_auth.db"
CODE_TTL_MIN = 30  # validade do código em minutos
ADMIN_USER_ID = 123456789  # seu user_id no Telegram (somente você pode autorizar)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS groups (
        chat_id INTEGER PRIMARY KEY, title TEXT, authorized_by INTEGER, authorized_at TEXT
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY, username TEXT, authorized_at TEXT
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS pending_codes (
        code TEXT PRIMARY KEY, target_id INTEGER, type TEXT, expires_at INTEGER, created_by INTEGER
    )""")
    conn.commit()
    conn.close()

def gen_code():
    return secrets.token_urlsafe(6)

def create_pending_code(target_id, type_, created_by):
    code = gen_code()
    expires_at = int(time.time() + CODE_TTL_MIN * 60)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT INTO pending_codes(code,target_id,type,expires_at,created_by) VALUES(?,?,?,?,?)",
                 (code, target_id, type_, expires_at, created_by))
    conn.commit(); conn.close()
    return code

def consume_code(code):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT target_id,type,expires_at FROM pending_codes WHERE code=?", (code,))
    row = cur.fetchone()
    if not row:
        conn.close(); return None
    target_id, type_, expires_at = row
    if int(time.time()) > expires_at:
        cur.execute("DELETE FROM pending_codes WHERE code=?", (code,))
        conn.commit(); conn.close(); return None
    # delete and return
    cur.execute("DELETE FROM pending_codes WHERE code=?", (code,))
    conn.commit(); conn.close()
    return {"target_id": target_id, "type": type_}

def authorize_group(chat_id, title, admin_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR REPLACE INTO groups(chat_id,title,authorized_by,authorized_at) VALUES(?,?,?,?)",
                 (chat_id, title, admin_id, datetime.utcnow().isoformat()))
    conn.commit(); conn.close()

def revoke_group(chat_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM groups WHERE chat_id=?", (chat_id,))
    conn.commit(); conn.close()

def is_group_authorized(chat_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM groups WHERE chat_id=?", (chat_id,))
    ok = cur.fetchone() is not None
    conn.close()
    return ok

def authorize_user(user_id, username):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR REPLACE INTO users(user_id,username,authorized_at) VALUES(?,?,?)",
                 (user_id, username, datetime.utcnow().isoformat()))
    conn.commit(); conn.close()

def is_user_authorized(user_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE user_id=?", (user_id,))
    ok = cur.fetchone() is not None
    conn.close()
    return ok

# --- Handlers (exemplos a adicionar ao Application) ---
# 1) Admin gera código para grupo:
# /authorize_group <chat_id>
async def authorize_group_cmd(update, context):
    if update.effective_user.id != ADMIN_USER_ID:
        await update.message.reply_text("Somente o administrador pode usar este comando.")
        return
    if not context.args:
        await update.message.reply_text("Use: /authorize_group <chat_id>")
        return
    target_chat_id = int(context.args[0])
    code = create_pending_code(target_chat_id, "group", update.effective_user.id)
    await update.message.reply_text(f"Código para autorizar o grupo {target_chat_id}: `{code}` (válido {CODE_TTL_MIN} min)", parse_mode="Markdown")

# 2) No grupo: admin do grupo usa /login <code>
async def login_group_cmd(update, context):
    # só admins do grupo podem vincular
    member = await context.bot.get_chat_member(update.effective_chat.id, update.effective_user.id)
    if member.status not in ("administrator", "creator"):
        await update.message.reply_text("Apenas administradores do grupo podem autorizar o bot aqui.")
        return
    if not context.args:
        await update.message.reply_text("Use: /login <code>")
        return
    code = context.args[0]
    info = consume_code(code)
    if not info or info["type"] != "group" or info["target_id"] != update.effective_chat.id:
        await update.message.reply_text("Código inválido ou expirado para este grupo.")
        return
    authorize_group(update.effective_chat.id, update.effective_chat.title or "", update.effective_user.id)
    await update.message.reply_text("Grupo autorizado com sucesso. Agora membros autorizados podem usar o bot aqui.")

# 3) Em privado: usuário usa /login <code> para autorizar sua conta
async def login_user_cmd(update, context):
    if not context.args:
        await update.message.reply_text("Use: /login <code>")
        return
    code = context.args[0]
    info = consume_code(code)
    if not info or info["type"] != "user" or info["target_id"] != update.effective_user.id:
        await update.message.reply_text("Código inválido ou expirado para sua conta.")
        return
    authorize_user(update.effective_user.id, update.effective_user.username or "")
    await update.message.reply_text("Conta autorizada com sucesso. Agora você pode usar o bot em privado.")

# 4) Antes de processar qualquer pedido ao IA, verifique autorização:
def check_authorized_for_update(update):
    if update.effective_chat.type in ("group","supergroup"):
        return is_group_authorized(update.effective_chat.id)
    else:
        return is_user_authorized(update.effective_user.id)

# Integre check_authorized_for_update() nas rotinas que chamam a IA.