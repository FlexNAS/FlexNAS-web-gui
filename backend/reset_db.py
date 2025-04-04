import sqlite3
import bcrypt
import os
import json

def reset_database():
    # Remove existing database if it exists
    if os.path.exists('nas.db'):
        os.remove('nas.db')
    
    # Create new database
    conn = sqlite3.connect('nas.db')
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        permissions TEXT NOT NULL DEFAULT 'read_files'
    )
    ''')
    
    # Create shares table
    cursor.execute('''
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
    
    # Create services table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        port INTEGER,
        enabled BOOLEAN DEFAULT 0,
        config TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Default admin user
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
    
    # Initialize default file sharing services
    services = [
        {
            'name': 'smb',
            'type': 'file_sharing',
            'port': 445,
            'enabled': 0,
            'config': json.dumps({
                'workgroup': 'WORKGROUP',
                'server_string': 'FlexNAS Server',
                'netbios_name': 'FLEXNAS',
                'security': 'user',
                'map_to_guest': 'Bad User',
                'guest_account': 'nobody'
            })
        },
        {
            'name': 'nfs',
            'type': 'file_sharing',
            'port': 2049,
            'enabled': 0,
            'config': json.dumps({
                'threads': 8,
                'udp': True,
                'nfs_version': '4.2',
                'allow_insecure_locks': False
            })
        },
        {
            'name': 'ftp',
            'type': 'file_sharing',
            'port': 21,
            'enabled': 0,
            'config': json.dumps({
                'anonymous_enable': False,
                'local_enable': True,
                'write_enable': True,
                'local_umask': '022',
                'max_clients': 10,
                'max_per_ip': 5,
                'passive_ports_min': 30000,
                'passive_ports_max': 31000
            })
        },
        {
            'name': 'webdav',
            'type': 'file_sharing',
            'port': 8080,
            'enabled': 0,
            'config': json.dumps({
                'authentication': 'basic',
                'ssl_enable': True,
                'digest_auth': False,
                'cors_allow': '*'
            })
        }
    ]
    
    for service in services:
        cursor.execute('''
        INSERT INTO services (name, type, port, enabled, config)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            service['name'],
            service['type'],
            service['port'],
            service['enabled'],
            service['config']
        ))
    
    conn.commit()
    conn.close()
    print("Database reset successfully!")

if __name__ == '__main__':
    reset_database() 