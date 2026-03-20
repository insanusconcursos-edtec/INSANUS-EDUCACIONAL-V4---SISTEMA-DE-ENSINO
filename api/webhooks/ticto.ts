import type { VercelRequest, VercelResponse } from '@vercel/node';
import { provisionTictoPurchase, revokeTictoPurchase } from '../../src/backend/services/provisioningService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Confiança no Body Parser Nativo
    const payload = req.body || {};
    
    // 2. Extração Tolerante a Falhas
    const incomingStatus = payload?.status;
    const incomingProductId = payload?.item?.product_id;
    const incomingToken = payload?.token;

    // 3. Aprovação IMEDIATA de Teste (Sem checar token - Bypass total)
    if (incomingStatus === 'waiting_payment' || incomingProductId === 1 || incomingProductId === '1') {
      return res.status(200).json({ received: true, message: "Teste Ticto Aprovado" });
    }

    // 4. Validação do Token para tráfego real
    const tictoToken = "Zbi2TLCWBPbYJU1Xz14JF7gt8LGm8LQ0tNfMzGcu0US35mR56ye4PFU44We9c5eHcYU6wDzNxNOkx13UDWsVd7FHzI1brmjRrt0i";
    if (incomingToken !== tictoToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, customer, item } = payload;

    // Log inicial de rastreio para requisições válidas
    console.log(`Webhook Ticto Recebido - Status: ${status} | Email: ${customer?.email} | Produto ID: ${item?.product_id}`);

    // 5. Execução (Incluindo 'authorized' para cartões aprovados)
    if (status === 'approved' || status === 'paid' || status === 'authorized') {
      await provisionTictoPurchase(customer, String(item.product_id));
    } else if (['refunded', 'chargeback', 'canceled', 'overdue'].includes(status)) {
      await revokeTictoPurchase(customer?.email, String(item.product_id));
    } else {
      console.log(`Status '${status}' ignorado. Nenhuma ação de provisionamento necessária.`);
    }

    // 6. Resposta limpa
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(200).json({ received: true, error: "Internal Error" });
  }
}
