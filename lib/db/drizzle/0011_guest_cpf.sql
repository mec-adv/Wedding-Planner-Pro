-- Fase: CPF do convidado e acompanhante (necessário para integração com Asaas)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS cpf varchar(14);
ALTER TABLE guest_companions ADD COLUMN IF NOT EXISTS cpf varchar(14);
