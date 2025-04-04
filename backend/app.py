from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
import bcrypt
import os
import psutil
import sqlite3
import json
from contextlib import contextmanager
import pathlib
from datetime import datetime
import platform
import subprocess

app = Flask(__name__)
# Configure CORS to allow requests from any origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-jwt-secret-key-here')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

# Initialize JWT
jwt = JWTManager(app)

# Database helper functions
@contextmanager
def get_db():
    db = sqlite3.connect('nas.db')
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()

def init_db():
    with get_db() as db:
        # Create users table
        db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            permissions TEXT NOT NULL DEFAULT 'read_files',
            last_login DATETIME
        )
        ''')

        # Create shares table
        db.execute('''
        CREATE TABLE IF NOT EXISTS shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            path TEXT NOT NULL,
            description TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_public BOOLEAN DEFAULT 0,
            allowed_users TEXT,
            read_only BOOLEAN DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
        ''')

        # Create backups table
        db.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source_path TEXT NOT NULL,
            destination_path TEXT NOT NULL,
            schedule TEXT,
            last_run DATETIME,
            next_run DATETIME,
            retention_days INTEGER DEFAULT 30,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active',
            type TEXT DEFAULT 'incremental',
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
        ''')

        # Create network settings table
        db.execute('''
        CREATE TABLE IF NOT EXISTS network_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hostname TEXT NOT NULL,
            domain TEXT,
            ip_address TEXT,
            subnet_mask TEXT,
            gateway TEXT,
            dns_servers TEXT,
            dhcp_enabled BOOLEAN DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create services table
        db.execute('''
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            port INTEGER,
            enabled BOOLEAN DEFAULT 1,
            config TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create quotas table
        db.execute('''
        CREATE TABLE IF NOT EXISTS quotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            path TEXT NOT NULL,
            soft_limit INTEGER,
            hard_limit INTEGER,
            used_space INTEGER DEFAULT 0,
            grace_period INTEGER DEFAULT 7,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')

        # Create activity log table
        db.execute('''
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')
        
        db.commit()

        # Create default admin user if not exists
        cursor = db.cursor()
        cursor.execute('SELECT * FROM users WHERE username = ?', ('admin',))
        if not cursor.fetchone():
            salt = bcrypt.gensalt()
            password_hash = bcrypt.hashpw('admin12345'.encode('utf-8'), salt).decode('utf-8')
            cursor.execute('''
            INSERT INTO users (username, email, password_hash, role, status, permissions)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                'admin',
                'admin@nas.local',
                password_hash,
                'admin',
                'active',
                'read_files,write_files,delete_files,manage_users,manage_system,view_logs'
            ))
            db.commit()

# Initialize database
init_db()

def log_activity(user_id, action, details=None):
    with get_db() as db:
        db.execute('''
        INSERT INTO activity_log (user_id, action, details)
        VALUES (?, ?, ?)
        ''', (user_id, action, details))
        db.commit()

# Routes
@app.route('/api/login', methods=['POST'])
def login():
    print("Login attempt received!")
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    print(f"Login attempt: Username={username}, Password={'*' * len(password) if password else 'None'}")
    
    # Get the user from the database
    conn = sqlite3.connect('nas.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, password_hash, role FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and bcrypt.checkpw(password.encode('utf-8'), user[2].encode('utf-8')):
        print(f"Login successful for user: {username}")
        # Create access token
        access_token = create_access_token(identity=user[0])
        
        # Log the activity
        log_activity(user[0], 'login', 'User logged in')
        
        return jsonify({
            'access_token': access_token,
            'user': user[1],
            'role': user[3]
        }), 200
    else:
        print(f"Login failed for user: {username}")
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['GET'])
@jwt_required()
def logout():
    current_user = get_jwt_identity()
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute('SELECT id FROM users WHERE username = ?', (current_user,))
        user = cursor.fetchone()
        if user:
            log_activity(user['id'], 'logout', f"User {current_user} logged out")
    return jsonify({'message': 'Successfully logged out'}), 200

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    with get_db() as db:
        current_user = db.execute('SELECT * FROM users WHERE username = ?', (get_jwt_identity(),)).fetchone()
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        users = db.execute('''
            SELECT id, username, email, role, status, permissions, last_login 
            FROM users
        ''').fetchall()
        return jsonify([{
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'permissions': user['permissions'].split(','),
            'lastLogin': user['last_login']
        } for user in users])

@app.route('/api/users', methods=['POST'])
@jwt_required()
def create_user():
    with get_db() as db:
        current_user = db.execute('SELECT * FROM users WHERE username = ?', (get_jwt_identity(),)).fetchone()
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), salt).decode('utf-8')
        
        try:
            cursor = db.cursor()
            cursor.execute('''
            INSERT INTO users (username, email, password_hash, role, permissions)
            VALUES (?, ?, ?, ?, ?)
            ''', (
                data['username'],
                data['email'],
                password_hash,
                data['role'],
                ','.join(data['permissions'])
            ))
            db.commit()
            log_activity(current_user['id'], 'create_user', f"Created user {data['username']}")
            return jsonify({'message': 'User created successfully'}), 201
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Username or email already exists'}), 400

@app.route('/api/activity-log', methods=['GET'])
@jwt_required()
def get_activity_log():
    with get_db() as db:
        current_user = db.execute('SELECT * FROM users WHERE username = ?', (get_jwt_identity(),)).fetchone()
        if 'view_logs' not in current_user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        logs = db.execute('''
            SELECT al.*, u.username 
            FROM activity_log al 
            JOIN users u ON al.user_id = u.id 
            ORDER BY al.timestamp DESC 
            LIMIT 100
        ''').fetchall()
        
        return jsonify([{
            'id': log['id'],
            'timestamp': log['timestamp'],
            'username': log['username'],
            'action': log['action'],
            'details': log['details']
        } for log in logs])

@app.route('/api/system-status', methods=['GET'])
@jwt_required()
def system_status():
    cpu_usage = psutil.cpu_percent()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return jsonify({
        'cpuUsage': cpu_usage,
        'memoryUsage': memory.percent,
        'storageUsage': disk.percent,
        'totalStorage': f"{disk.total / (1024**3):.2f}GB",
        'usedStorage': f"{disk.used / (1024**3):.2f}GB",
        'freeStorage': f"{disk.free / (1024**3):.2f}GB",
        'systemStatus': 'healthy' if cpu_usage < 80 and memory.percent < 80 and disk.percent < 80 else 'warning'
    })

@app.route('/api/volumes', methods=['GET'])
@jwt_required()
def get_volumes():
    volumes = []
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            volumes.append({
                'device': partition.device,
                'mountpoint': partition.mountpoint,
                'fstype': partition.fstype,
                'total': usage.total,
                'used': usage.used,
                'free': usage.free,
                'percent': usage.percent
            })
        except Exception:
            continue
    return jsonify(volumes)

@app.route('/api/files', methods=['GET'])
@jwt_required()
def list_files():
    path = request.args.get('path', '/')
    try:
        base_path = pathlib.Path(path)
        if not base_path.exists():
            return jsonify({'error': 'Path does not exist'}), 404
        
        files = []
        for item in base_path.iterdir():
            try:
                stat = item.stat()
                files.append({
                    'name': item.name,
                    'path': str(item),
                    'type': 'directory' if item.is_dir() else 'file',
                    'size': stat.st_size if item.is_file() else None,
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except Exception:
                continue
        
        return jsonify(files)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/shares', methods=['GET'])
@jwt_required()
def get_shares():
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] == 'admin':
            shares = db.execute('''
                SELECT s.*, u.username as creator
                FROM shares s
                JOIN users u ON s.created_by = u.id
            ''').fetchall()
        else:
            shares = db.execute('''
                SELECT s.*, u.username as creator
                FROM shares s
                JOIN users u ON s.created_by = u.id
                WHERE s.is_public = 1 OR s.allowed_users LIKE ?
            ''', (f'%{current_user}%',)).fetchall()
        
        return jsonify([{
            'id': share['id'],
            'name': share['name'],
            'path': share['path'],
            'description': share['description'],
            'creator': share['creator'],
            'createdAt': share['created_at'],
            'isPublic': bool(share['is_public']),
            'allowedUsers': share['allowed_users'].split(',') if share['allowed_users'] else [],
            'readOnly': bool(share['read_only'])
        } for share in shares])

@app.route('/api/shares', methods=['POST'])
@jwt_required()
def create_share():
    current_user = get_jwt_identity()
    data = request.get_json()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_shares' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        try:
            cursor = db.cursor()
            cursor.execute('''
            INSERT INTO shares (name, path, description, created_by, is_public, allowed_users, read_only)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['name'],
                data['path'],
                data.get('description', ''),
                user['id'],
                data.get('isPublic', False),
                ','.join(data.get('allowedUsers', [])),
                data.get('readOnly', False)
            ))
            db.commit()
            log_activity(user['id'], 'create_share', f"Created share {data['name']}")
            return jsonify({'message': 'Share created successfully'}), 201
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Share name already exists'}), 400

@app.route('/api/shares/<int:share_id>', methods=['DELETE'])
@jwt_required()
def delete_share(share_id):
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_shares' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        cursor = db.cursor()
        cursor.execute('DELETE FROM shares WHERE id = ?', (share_id,))
        if cursor.rowcount == 0:
            return jsonify({'error': 'Share not found'}), 404
        
        db.commit()
        log_activity(user['id'], 'delete_share', f"Deleted share {share_id}")
        return jsonify({'message': 'Share deleted successfully'}), 200

@app.route('/api/shares/<int:share_id>', methods=['PUT'])
@jwt_required()
def update_share(share_id):
    current_user = get_jwt_identity()
    data = request.get_json()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_shares' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        cursor = db.cursor()
        cursor.execute('''
        UPDATE shares 
        SET name = ?, path = ?, description = ?, is_public = ?, allowed_users = ?, read_only = ?
        WHERE id = ?
        ''', (
            data['name'],
            data['path'],
            data.get('description', ''),
            data.get('isPublic', False),
            ','.join(data.get('allowedUsers', [])),
            data.get('readOnly', False),
            share_id
        ))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Share not found'}), 404
        
        db.commit()
        log_activity(user['id'], 'update_share', f"Updated share {share_id}")
        return jsonify({'message': 'Share updated successfully'}), 200

@app.route('/api/backups', methods=['GET'])
@jwt_required()
def get_backups():
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_backups' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        backups = db.execute('''
            SELECT b.*, u.username as creator
            FROM backups b
            JOIN users u ON b.created_by = u.id
        ''').fetchall()
        
        return jsonify([{
            'id': backup['id'],
            'name': backup['name'],
            'sourcePath': backup['source_path'],
            'destinationPath': backup['destination_path'],
            'schedule': backup['schedule'],
            'lastRun': backup['last_run'],
            'nextRun': backup['next_run'],
            'retentionDays': backup['retention_days'],
            'creator': backup['creator'],
            'createdAt': backup['created_at'],
            'status': backup['status'],
            'type': backup['type']
        } for backup in backups])

@app.route('/api/backups', methods=['POST'])
@jwt_required()
def create_backup():
    current_user = get_jwt_identity()
    data = request.get_json()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_backups' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        try:
            cursor = db.cursor()
            cursor.execute('''
            INSERT INTO backups (
                name, source_path, destination_path, schedule, 
                retention_days, created_by, type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['name'],
                data['sourcePath'],
                data['destinationPath'],
                data.get('schedule', ''),
                data.get('retentionDays', 30),
                user['id'],
                data.get('type', 'incremental')
            ))
            db.commit()
            log_activity(user['id'], 'create_backup', f"Created backup {data['name']}")
            return jsonify({'message': 'Backup created successfully'}), 201
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Backup name already exists'}), 400

@app.route('/api/backups/<int:backup_id>', methods=['DELETE'])
@jwt_required()
def delete_backup(backup_id):
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_backups' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        cursor = db.cursor()
        cursor.execute('DELETE FROM backups WHERE id = ?', (backup_id,))
        if cursor.rowcount == 0:
            return jsonify({'error': 'Backup not found'}), 404
        
        db.commit()
        log_activity(user['id'], 'delete_backup', f"Deleted backup {backup_id}")
        return jsonify({'message': 'Backup deleted successfully'}), 200

@app.route('/api/backups/<int:backup_id>/run', methods=['POST'])
@jwt_required()
def run_backup(backup_id):
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_backups' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        backup = db.execute('SELECT * FROM backups WHERE id = ?', (backup_id,)).fetchone()
        if not backup:
            return jsonify({'error': 'Backup not found'}), 404
        
        # Here you would implement the actual backup logic
        # For now, we'll just update the last_run timestamp
        cursor = db.cursor()
        cursor.execute('''
        UPDATE backups 
        SET last_run = CURRENT_TIMESTAMP,
            next_run = datetime(CURRENT_TIMESTAMP, '+' || retention_days || ' days')
        WHERE id = ?
        ''', (backup_id,))
        
        db.commit()
        log_activity(user['id'], 'run_backup', f"Ran backup {backup_id}")
        return jsonify({'message': 'Backup started successfully'}), 200

@app.route('/api/quotas', methods=['GET'])
@jwt_required()
def get_quotas():
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        
        if user['role'] == 'admin':
            # Admins can see all quotas
            quotas = db.execute('''
                SELECT q.*, u.username 
                FROM quotas q
                JOIN users u ON q.user_id = u.id
            ''').fetchall()
        else:
            # Regular users can only see their own quotas
            quotas = db.execute('''
                SELECT q.*, u.username 
                FROM quotas q
                JOIN users u ON q.user_id = u.id
                WHERE q.user_id = ?
            ''', (user['id'],)).fetchall()
            
        return jsonify([{
            'id': q['id'],
            'username': q['username'],
            'path': q['path'],
            'softLimit': q['soft_limit'],
            'hardLimit': q['hard_limit'],
            'usedSpace': q['used_space'],
            'gracePeriod': q['grace_period'],
            'createdAt': q['created_at'],
            'updatedAt': q['updated_at']
        } for q in quotas])

@app.route('/api/quotas', methods=['POST'])
@jwt_required()
def create_quota():
    current_user = get_jwt_identity()
    data = request.get_json()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        target_user = db.execute('SELECT * FROM users WHERE username = ?', (data['username'],)).fetchone()
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
        
        try:
            cursor = db.cursor()
            cursor.execute('''
                INSERT INTO quotas (user_id, path, soft_limit, hard_limit, grace_period)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                target_user['id'],
                data['path'],
                data['softLimit'],
                data['hardLimit'],
                data.get('gracePeriod', 7)
            ))
            db.commit()
            
            log_activity(user['id'], 'create_quota', f"Created quota for {data['username']} on {data['path']}")
            return jsonify({'message': 'Quota created successfully'}), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/quotas/<int:quota_id>', methods=['PUT'])
@jwt_required()
def update_quota(quota_id):
    current_user = get_jwt_identity()
    data = request.get_json()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        quota = db.execute('SELECT * FROM quotas WHERE id = ?', (quota_id,)).fetchone()
        if not quota:
            return jsonify({'error': 'Quota not found'}), 404
        
        try:
            cursor = db.cursor()
            cursor.execute('''
                UPDATE quotas
                SET soft_limit = ?, hard_limit = ?, grace_period = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data['softLimit'],
                data['hardLimit'],
                data.get('gracePeriod', quota['grace_period']),
                quota_id
            ))
            db.commit()
            
            log_activity(user['id'], 'update_quota', f"Updated quota id {quota_id}")
            return jsonify({'message': 'Quota updated successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/quotas/<int:quota_id>', methods=['DELETE'])
@jwt_required()
def delete_quota(quota_id):
    current_user = get_jwt_identity()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        quota = db.execute('SELECT * FROM quotas WHERE id = ?', (quota_id,)).fetchone()
        if not quota:
            return jsonify({'error': 'Quota not found'}), 404
        
        try:
            cursor = db.cursor()
            cursor.execute('DELETE FROM quotas WHERE id = ?', (quota_id,))
            db.commit()
            
            log_activity(user['id'], 'delete_quota', f"Deleted quota id {quota_id}")
            return jsonify({'message': 'Quota deleted successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/users/<string:username>/quota', methods=['GET'])
@jwt_required()
def get_user_quota(username):
    current_user = get_jwt_identity()
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and current_user != username:
            return jsonify({'error': 'Unauthorized'}), 403
        
        target_user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
        
        quotas = db.execute('''
            SELECT * FROM quotas WHERE user_id = ?
        ''', (target_user['id'],)).fetchall()
        
        return jsonify([{
            'id': q['id'],
            'username': username,
            'path': q['path'],
            'softLimit': q['soft_limit'],
            'hardLimit': q['hard_limit'],
            'usedSpace': q['used_space'],
            'gracePeriod': q['grace_period'],
            'createdAt': q['created_at'],
            'updatedAt': q['updated_at']
        } for q in quotas])

@app.route('/api/settings/network', methods=['GET'])
@jwt_required()
def get_network_settings():
    with get_db() as db:
        settings = db.execute('SELECT * FROM network_settings').fetchone()
        if settings:
            return jsonify({
                'hostname': settings['hostname'],
                'domain': settings['domain'],
                'ipAddress': settings['ip_address'],
                'subnetMask': settings['subnet_mask'],
                'gateway': settings['gateway'],
                'dnsServers': json.loads(settings['dns_servers']) if settings['dns_servers'] else [],
                'dhcpEnabled': bool(settings['dhcp_enabled'])
            })
        return jsonify({}), 404

@app.route('/api/settings/network', methods=['PUT'])
@jwt_required()
def update_network_settings():
    data = request.get_json()
    with get_db() as db:
        try:
            cursor = db.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO network_settings (
                    hostname, domain, ip_address, subnet_mask,
                    gateway, dns_servers, dhcp_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['hostname'],
                data['domain'],
                data['ipAddress'],
                data['subnetMask'],
                data['gateway'],
                json.dumps(data['dnsServers']),
                int(data['dhcpEnabled'])
            ))
            db.commit()
            
            # Apply hostname change on Linux systems
            if platform.system() == 'Linux':
                try:
                    subprocess.run(['hostnamectl', 'set-hostname', data['hostname']], check=True)
                except subprocess.CalledProcessError:
                    pass  # Ignore errors in development environment
            
            return jsonify({'message': 'Network settings updated successfully'})
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Failed to update network settings'}), 400

@app.route('/api/services', methods=['GET'])
@jwt_required()
def get_services():
    with get_db() as db:
        services = db.execute('SELECT * FROM services').fetchall()
        return jsonify([{
            'id': service['id'],
            'name': service['name'],
            'displayName': service['name'].replace('_', ' ').title(),
            'description': f"{service['name'].replace('_', ' ').title()} service",
            'status': 'running' if service['enabled'] else 'stopped',
            'isEnabled': bool(service['enabled']),
            'startType': 'automatic',
            'config': json.loads(service['config']),
            'lastStarted': service['updated_at']
        } for service in services])

@app.route('/api/services/<int:service_id>', methods=['PUT'])
@jwt_required()
def update_service(service_id):
    data = request.get_json()
    with get_db() as db:
        try:
            cursor = db.cursor()
            cursor.execute('''
                UPDATE services
                SET enabled = ?, config = ?
                WHERE id = ?
            ''', (
                int(data['isEnabled']),
                json.dumps(data['config']),
                service_id
            ))
            db.commit()
            return jsonify({'message': 'Service updated successfully'})
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Failed to update service'}), 400

@app.route('/api/services/<int:service_id>/<action>', methods=['POST'])
@jwt_required()
def control_service(service_id, action):
    if action not in ['start', 'stop', 'restart']:
        return jsonify({'error': 'Invalid action'}), 400
    
    with get_db() as db:
        try:
            cursor = db.cursor()
            if action == 'start':
                cursor.execute('UPDATE services SET enabled = 1 WHERE id = ?', (service_id,))
            elif action == 'stop':
                cursor.execute('UPDATE services SET enabled = 0 WHERE id = ?', (service_id,))
            elif action == 'restart':
                cursor.execute('UPDATE services SET enabled = 0 WHERE id = ?', (service_id,))
                cursor.execute('UPDATE services SET enabled = 1 WHERE id = ?', (service_id,))
            db.commit()
            return jsonify({'message': f'Service {action}ed successfully'})
        except sqlite3.IntegrityError:
            return jsonify({'error': f'Failed to {action} service'}), 400

# System Settings endpoints
@app.route('/api/settings', methods=['GET'])
@jwt_required()
def get_settings():
    with get_db() as db:
        # Get system settings
        system_config = db.execute('SELECT * FROM system_settings').fetchone()
        network_config = db.execute('SELECT * FROM network_settings').fetchone()
        storage_config = db.execute('SELECT * FROM storage_settings').fetchone()
        
        return jsonify({
            'system': {
                'hostname': system_config['hostname'] if system_config else '',
                'timezone': system_config['timezone'] if system_config else '',
                'enableAutomaticUpdates': bool(system_config['enable_updates']) if system_config else False,
                'enableSSH': bool(system_config['enable_ssh']) if system_config else False,
                'sshPort': system_config['ssh_port'] if system_config else 22
            },
            'network': {
                'enableDHCP': bool(network_config['dhcp_enabled']) if network_config else True,
                'ipAddress': network_config['ip_address'] if network_config else '',
                'subnetMask': network_config['subnet_mask'] if network_config else '',
                'gateway': network_config['gateway'] if network_config else '',
                'dnsServers': json.loads(network_config['dns_servers']) if network_config and network_config['dns_servers'] else []
            },
            'storage': {
                'raidLevel': storage_config['raid_level'] if storage_config else 'RAID 1',
                'enableAutoRaidRepair': bool(storage_config['auto_repair']) if storage_config else True,
                'enableSmartMonitoring': bool(storage_config['smart_monitoring']) if storage_config else True,
                'enableAutomatedBackups': bool(storage_config['automated_backups']) if storage_config else False,
                'backupSchedule': storage_config['backup_schedule'] if storage_config else '0 0 * * *'
            }
        })

@app.route('/api/settings/system', methods=['PUT'])
@jwt_required()
def update_system_settings():
    data = request.get_json()
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO system_settings (
                hostname, timezone, enable_updates, enable_ssh, ssh_port
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            data['hostname'],
            data['timezone'],
            int(data['enableAutomaticUpdates']),
            int(data['enableSSH']),
            data['sshPort']
        ))
        db.commit()
        
        # Apply hostname change
        if platform.system() == 'Linux':
            try:
                subprocess.run(['hostnamectl', 'set-hostname', data['hostname']], check=True)
            except subprocess.CalledProcessError:
                pass  # Ignore errors in development environment
                
        return jsonify({'message': 'System settings updated successfully'})

@app.route('/api/settings/storage', methods=['PUT'])
@jwt_required()
def update_storage_settings():
    data = request.get_json()
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO storage_settings (
                raid_level, auto_repair, smart_monitoring,
                automated_backups, backup_schedule
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            data['raidLevel'],
            int(data['enableAutoRaidRepair']),
            int(data['enableSmartMonitoring']),
            int(data['enableAutomatedBackups']),
            data['backupSchedule']
        ))
        db.commit()
        return jsonify({'message': 'Storage settings updated successfully'})

# Create required tables if they don't exist
def init_settings_db():
    with get_db() as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hostname TEXT NOT NULL,
                timezone TEXT NOT NULL,
                enable_updates INTEGER DEFAULT 0,
                enable_ssh INTEGER DEFAULT 0,
                ssh_port INTEGER DEFAULT 22
            )
        ''')
        
        db.execute('''
            CREATE TABLE IF NOT EXISTS network_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dhcp_enabled INTEGER DEFAULT 1,
                ip_address TEXT,
                subnet_mask TEXT,
                gateway TEXT,
                dns_servers TEXT
            )
        ''')
        
        db.execute('''
            CREATE TABLE IF NOT EXISTS storage_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raid_level TEXT DEFAULT 'RAID 1',
                auto_repair INTEGER DEFAULT 1,
                smart_monitoring INTEGER DEFAULT 1,
                automated_backups INTEGER DEFAULT 0,
                backup_schedule TEXT DEFAULT '0 0 * * *'
            )
        ''')
        db.commit()

# Initialize settings tables
init_settings_db()

@app.route('/api/protocols', methods=['GET'])
def get_protocols():
    with get_db() as db:
        services = db.execute('''
            SELECT * FROM services 
            WHERE type = 'file_sharing'
        ''').fetchall()
        
        return jsonify([{
            'id': service['id'],
            'name': service['name'],
            'displayName': service['name'].upper(),
            'description': f"{service['name'].upper()} file sharing protocol",
            'port': service['port'],
            'status': 'running' if service['enabled'] else 'stopped',
            'isEnabled': bool(service['enabled']),
            'config': json.loads(service['config']) if service['config'] else {},
            'lastUpdated': service['updated_at']
        } for service in services])

@app.route('/api/protocols/<protocol_name>', methods=['GET'])
def get_protocol_config(protocol_name):
    with get_db() as db:
        service = db.execute('''
            SELECT * FROM services 
            WHERE name = ? AND type = 'file_sharing'
        ''', (protocol_name.lower(),)).fetchone()
        
        if not service:
            return jsonify({'error': 'Protocol not found'}), 404
        
        return jsonify({
            'id': service['id'],
            'name': service['name'],
            'displayName': service['name'].upper(),
            'description': f"{service['name'].upper()} file sharing protocol",
            'port': service['port'],
            'status': 'running' if service['enabled'] else 'stopped',
            'isEnabled': bool(service['enabled']),
            'config': json.loads(service['config']) if service['config'] else {},
            'lastUpdated': service['updated_at']
        })

@app.route('/api/protocols/<protocol_name>', methods=['PUT'])
@jwt_required()
def update_protocol_config(protocol_name):
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_system' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        service = db.execute('''
            SELECT * FROM services 
            WHERE name = ? AND type = 'file_sharing'
        ''', (protocol_name.lower(),)).fetchone()
        
        if not service:
            return jsonify({'error': 'Protocol not found'}), 404
        
        data = request.get_json()
        
        try:
            db.execute('''
                UPDATE services 
                SET port = ?, enabled = ?, config = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data.get('port', service['port']),
                1 if data.get('isEnabled', False) else 0,
                json.dumps(data.get('config', {})),
                service['id']
            ))
            db.commit()
            
            log_activity(user['id'], 'update_protocol', f"Updated {protocol_name} configuration")
            return jsonify({'message': f'{protocol_name.upper()} configuration updated successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/protocols/<protocol_name>/<action>', methods=['POST'])
@jwt_required()
def control_protocol(protocol_name, action):
    if action not in ['start', 'stop', 'restart']:
        return jsonify({'error': 'Invalid action'}), 400
    
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_system' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        service = db.execute('''
            SELECT * FROM services 
            WHERE name = ? AND type = 'file_sharing'
        ''', (protocol_name.lower(),)).fetchone()
        
        if not service:
            return jsonify({'error': 'Protocol not found'}), 404
        
        try:
            if action == 'start':
                db.execute('''
                    UPDATE services 
                    SET enabled = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (service['id'],))
            elif action == 'stop':
                db.execute('''
                    UPDATE services 
                    SET enabled = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (service['id'],))
            elif action == 'restart':
                db.execute('''
                    UPDATE services 
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (service['id'],))
            
            db.commit()
            log_activity(user['id'], f'{action}_protocol', f"{action.capitalize()}ed {protocol_name} service")
            return jsonify({'message': f'{protocol_name.upper()} service {action}ed successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/protocols/<protocol_name>/shares', methods=['GET'])
@jwt_required()
def get_protocol_shares(protocol_name):
    with get_db() as db:
        service = db.execute('''
            SELECT * FROM services 
            WHERE name = ? AND type = 'file_sharing'
        ''', (protocol_name.lower(),)).fetchone()
        
        if not service:
            return jsonify({'error': 'Protocol not found'}), 404
        
        # Get all shares and their protocol-specific settings
        shares = db.execute('''
            SELECT s.*, u.username as creator
            FROM shares s
            JOIN users u ON s.created_by = u.id
        ''').fetchall()
        
        protocol_shares = []
        for share in shares:
            config = json.loads(service['config'])
            share_config = config.get('shares', {}).get(share['name'], {})
            
            protocol_shares.append({
                'id': share['id'],
                'name': share['name'],
                'path': share['path'],
                'description': share['description'],
                'creator': share['creator'],
                'createdAt': share['created_at'],
                'isPublic': bool(share['is_public']),
                'allowedUsers': share['allowed_users'].split(',') if share['allowed_users'] else [],
                'readOnly': bool(share['read_only']),
                'protocolConfig': share_config
            })
        
        return jsonify(protocol_shares)

@app.route('/api/protocols/<protocol_name>/shares/<int:share_id>', methods=['PUT'])
@jwt_required()
def update_protocol_share(protocol_name, share_id):
    current_user = get_jwt_identity()
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (current_user,)).fetchone()
        if user['role'] != 'admin' and 'manage_shares' not in user['permissions'].split(','):
            return jsonify({'error': 'Unauthorized'}), 403
        
        service = db.execute('''
            SELECT * FROM services 
            WHERE name = ? AND type = 'file_sharing'
        ''', (protocol_name.lower(),)).fetchone()
        
        if not service:
            return jsonify({'error': 'Protocol not found'}), 404
        
        share = db.execute('SELECT * FROM shares WHERE id = ?', (share_id,)).fetchone()
        if not share:
            return jsonify({'error': 'Share not found'}), 404
        
        data = request.get_json()
        config = json.loads(service['config']) if service['config'] else {}
        
        if 'shares' not in config:
            config['shares'] = {}
        
        config['shares'][share['name']] = data.get('protocolConfig', {})
        
        try:
            db.execute('''
                UPDATE services 
                SET config = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (json.dumps(config), service['id']))
            
            db.commit()
            log_activity(user['id'], 'update_protocol_share', f"Updated {protocol_name} settings for share {share['name']}")
            return jsonify({'message': f'Share {protocol_name.upper()} settings updated successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 