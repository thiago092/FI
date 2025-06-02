@echo off
echo Deploying FinançasAI to Azure App Service

echo Installing Python dependencies...
D:\home\Python311\python.exe -m pip install --upgrade pip
D:\home\Python311\python.exe -m pip install -r requirements.txt

echo Deployment completed successfully
echo Application will be started with gunicorn 