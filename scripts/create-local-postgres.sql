-- Execute como superusuário (ex.: postgres) no psql ou pgAdmin Query Tool.
-- Ajuste a senha antes de rodar em produção.

CREATE USER casamento360 WITH PASSWORD 'casamento360_dev';
CREATE DATABASE casamento360 OWNER casamento360;
GRANT ALL PRIVILEGES ON DATABASE casamento360 TO casamento360;
