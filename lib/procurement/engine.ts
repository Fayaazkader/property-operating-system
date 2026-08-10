// lib/procurement/engine.ts — Façade over domain services

export { createSpendRequest, getSpendRequests } from './services/spend-request.service';
export { issueRFQ } from './services/rfq.service';
export { createPO, receiveGoods } from './services/purchase-order.service';
