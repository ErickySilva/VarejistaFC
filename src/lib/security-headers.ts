// Cabeçalhos de segurança enviados em todas as respostas (next.config.ts).
//
// O HSTS (Strict-Transport-Security) não fica aqui de propósito: ele só faz
// sentido quando o site já responde por HTTPS, então é definido no Nginx, no
// bloco HTTPS (deploy/nginx/https.conf.example).
//
// Não há uma Content-Security-Policy completa: restringir scripts exige
// adaptar o carregamento do Next e fica para uma etapa própria. A diretiva
// `frame-ancestors` sozinha não afeta scripts nem estilos.
export const securityHeaders = [
  // O navegador não tenta adivinhar o tipo de um arquivo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // O site não pode ser embutido em outra página (clickjacking). Os dois
  // cabeçalhos dizem o mesmo; o segundo é o padrão atual.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Para outros sites vai só a origem, sem o caminho da página.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
