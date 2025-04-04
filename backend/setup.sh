#!/bin/bash

# Update system
sudo apt update
sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-venv nginx

# Create project directory
sudo mkdir -p /var/www/nas-web-gui
sudo chown -R $USER:$USER /var/www/nas-web-gui

# Copy files to installation directory
sudo cp -r ../frontend/dist /var/www/nas-web-gui/frontend/
sudo cp -r . /var/www/nas-web-gui/backend/

# Set up Python virtual environment
cd /var/www/nas-web-gui/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up Nginx
sudo cp nginx.conf /etc/nginx/sites-available/nas-web-gui
sudo ln -s /etc/nginx/sites-available/nas-web-gui /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

# Set up systemd service
sudo cp nas-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable nas-backend
sudo systemctl start nas-backend

echo "Installation complete!"
echo "Default credentials:"
echo "Username: admin"
echo "Password: admin12345" 