import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging
from jinja2 import Template
from ..core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = settings.MAIL_SERVER
        self.smtp_port = settings.MAIL_PORT
        self.username = settings.MAIL_USERNAME
        self.password = settings.MAIL_PASSWORD
        self.from_email = settings.MAIL_FROM or settings.MAIL_USERNAME
        self.from_name = settings.MAIL_FROM_NAME
        self.use_tls = settings.MAIL_TLS
        self.use_ssl = settings.MAIL_SSL

    def _create_smtp_connection(self):
        """Criar conexão SMTP com Zoho"""
        try:
            if self.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context)
            else:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                if self.use_tls:
                    server.starttls()
            
            server.login(self.username, self.password)
            return server
        except Exception as e:
            logger.error(f"Erro ao conectar com servidor SMTP: {str(e)}")
            raise

    def send_email(self, 
                   to_emails: List[str], 
                   subject: str, 
                   html_content: str, 
                   text_content: Optional[str] = None):
        """Enviar email usando Zoho SMTP"""
        try:
            if not self.username or not self.password:
                logger.error("Credenciais de email não configuradas")
                return False

            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = ', '.join(to_emails)

            # Adicionar conteúdo texto e HTML
            if text_content:
                text_part = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)

            # Enviar email
            with self._create_smtp_connection() as server:
                server.send_message(msg)
            
            logger.info(f"Email enviado com sucesso para: {', '.join(to_emails)}")
            return True

        except Exception as e:
            logger.error(f"Erro ao enviar email: {str(e)}")
            return False

    def send_email_verification(self, email: str, full_name: str, verification_token: str):
        """Enviar email de verificação de conta"""
        verification_url = f"https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/verify-email?token={verification_token}"
        
        # Template HTML do email
        html_template = Template("""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirme seu email - Finanças AI</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .highlight {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Bem-vindo ao Finanças AI!</h1>
        </div>
        <div class="content">
            <h2>Olá, {{ full_name }}!</h2>
            <p>Obrigado por se cadastrar no <strong>Finanças AI</strong>! Para completar seu cadastro e começar a usar nossa plataforma, você precisa confirmar seu endereço de email.</p>
            
            <div class="highlight">
                <p><strong>📧 Confirme seu email para:</strong></p>
                <ul>
                    <li>Acessar todas as funcionalidades da plataforma</li>
                    <li>Receber notificações importantes</li>
                    <li>Garantir a segurança da sua conta</li>
                    <li>Receber dicas de gestão financeira</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ verification_url }}" class="btn">✅ Confirmar Email</a>
            </div>

            <p><strong>⏰ Este link expira em 24 horas.</strong></p>
            
            <p>Se você não conseguir clicar no botão, copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace;">{{ verification_url }}</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p><small>Se você não se cadastrou no Finanças AI, pode ignorar este email com segurança.</small></p>
        </div>
        <div class="footer">
            <p>© 2024 Finanças AI - Sua plataforma de gestão financeira inteligente</p>
            <p>Este é um email automático, não responda esta mensagem.</p>
        </div>
    </div>
</body>
</html>
        """)

        # Template texto simples
        text_template = Template("""
Olá, {{ full_name }}!

Bem-vindo ao Finanças AI!

Para completar seu cadastro, confirme seu email clicando no link abaixo:
{{ verification_url }}

Este link expira em 24 horas.

Se você não se cadastrou no Finanças AI, pode ignorar este email.

---
Finanças AI - Sua plataforma de gestão financeira inteligente
        """)

        html_content = html_template.render(
            full_name=full_name,
            verification_url=verification_url
        )
        
        text_content = text_template.render(
            full_name=full_name,
            verification_url=verification_url
        )

        return self.send_email(
            to_emails=[email],
            subject="🎉 Confirme seu email - Finanças AI",
            html_content=html_content,
            text_content=text_content
        )

    def send_password_reset(self, email: str, full_name: str, reset_token: str):
        """Enviar email de recuperação de senha"""
        reset_url = f"https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/reset-password?token={reset_token}"
        
        html_template = Template("""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperar senha - Finanças AI</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .warning {
            background: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Recuperar Senha</h1>
        </div>
        <div class="content">
            <h2>Olá, {{ full_name }}!</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Finanças AI</strong>.</p>
            
            <div class="warning">
                <p><strong>⚠️ Importante:</strong></p>
                <ul>
                    <li>Se você não solicitou esta alteração, ignore este email</li>
                    <li>Este link expira em 1 hora por segurança</li>
                    <li>Nunca compartilhe este link com outras pessoas</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ reset_url }}" class="btn">🔑 Redefinir Senha</a>
            </div>
            
            <p>Se você não conseguir clicar no botão, copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace;">{{ reset_url }}</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p><small>Se você não solicitou a recuperação de senha, pode ignorar este email com segurança. Sua senha não será alterada.</small></p>
        </div>
        <div class="footer">
            <p>© 2024 Finanças AI - Sua plataforma de gestão financeira inteligente</p>
            <p>Este é um email automático, não responda esta mensagem.</p>
        </div>
    </div>
</body>
</html>
        """)

        text_template = Template("""
Olá, {{ full_name }}!

Recebemos uma solicitação para redefinir a senha da sua conta no Finanças AI.

Para redefinir sua senha, clique no link abaixo:
{{ reset_url }}

Este link expira em 1 hora.

Se você não solicitou esta alteração, ignore este email.

---
Finanças AI - Sua plataforma de gestão financeira inteligente
        """)

        html_content = html_template.render(
            full_name=full_name,
            reset_url=reset_url
        )
        
        text_content = text_template.render(
            full_name=full_name,
            reset_url=reset_url
        )

        return self.send_email(
            to_emails=[email],
            subject="🔐 Recuperar senha - Finanças AI",
            html_content=html_content,
            text_content=text_content
        )

# Instância global do serviço
email_service = EmailService() 