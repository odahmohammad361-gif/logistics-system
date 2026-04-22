import api from './api'
import type { ShippingAgent, AgentListResponse, ClearanceAgent, ClearanceAgentListResponse } from '@/types'

// ── Shipping Agents ────────────────────────────────────────────────────────
export const getAgents = (params?: Record<string, unknown>) =>
  api.get<AgentListResponse>('/shipping-agents', { params }).then((r) => r.data)

export const getAgent = (id: number) =>
  api.get<ShippingAgent>(`/shipping-agents/${id}`).then((r) => r.data)

export const createAgent = (data: unknown) =>
  api.post<ShippingAgent>('/shipping-agents', data).then((r) => r.data)

export const updateAgent = (id: number, data: unknown) =>
  api.patch<ShippingAgent>(`/shipping-agents/${id}`, data).then((r) => r.data)

export const deleteAgent = (id: number) =>
  api.delete(`/shipping-agents/${id}`)

export const compareAgents = (params?: Record<string, unknown>) =>
  api.get('/shipping-agents/compare', { params }).then((r) => r.data)

// ── Agent Quotes ───────────────────────────────────────────────────────────
export const getAgentQuotes = (agentId: number) =>
  api.get(`/shipping-agents/${agentId}/quotes`).then((r) => r.data)

export const createQuote = (agentId: number, data: unknown) =>
  api.post(`/shipping-agents/${agentId}/quotes`, data).then((r) => r.data)

export const updateQuote = (agentId: number, quoteId: number, data: unknown) =>
  api.patch(`/shipping-agents/${agentId}/quotes/${quoteId}`, data).then((r) => r.data)

export const deleteQuote = (agentId: number, quoteId: number) =>
  api.delete(`/shipping-agents/${agentId}/quotes/${quoteId}`)

// ── Clearance Agents ───────────────────────────────────────────────────────
export const getClearanceAgents = (params?: Record<string, unknown>) =>
  api.get<ClearanceAgentListResponse>('/clearance-agents', { params }).then((r) => r.data)

export const getClearanceAgent = (id: number) =>
  api.get<ClearanceAgent>(`/clearance-agents/${id}`).then((r) => r.data)

export const createClearanceAgent = (data: unknown) =>
  api.post<ClearanceAgent>('/clearance-agents', data).then((r) => r.data)

export const updateClearanceAgent = (id: number, data: unknown) =>
  api.patch<ClearanceAgent>(`/clearance-agents/${id}`, data).then((r) => r.data)

export const deleteClearanceAgent = (id: number) =>
  api.delete(`/clearance-agents/${id}`)
