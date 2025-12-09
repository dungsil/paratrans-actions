import { type GenerativeModel, GoogleGenerativeAI, FinishReason } from '@google/generative-ai'
import dotenv from 'dotenv'
import { type GameType, getSystemPrompt } from './prompts'
import { addQueue } from './queue'

dotenv.config()

/**
 * 번역이 AI에 의해 거부되었을 때 발생하는 오류
 * 안전 필터, 콘텐츠 정책 등의 이유로 번역을 수행할 수 없는 경우
 */
export class TranslationRefusedError extends Error {
  constructor(
    public readonly text: string,
    public readonly reason: string,
  ) {
    super(`번역 거부: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (사유: ${reason})`)
    this.name = 'TranslationRefusedError'
  }
}

const ai = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_TOKEN!)

const generationConfig = {
  temperature: 0.5,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
}

const gemini = (model: string, gameType: GameType, useTransliteration: boolean = false) => ai.getGenerativeModel({
  model,
  generationConfig,
  systemInstruction: getSystemPrompt(gameType, useTransliteration),
})

export interface RetranslationContext {
  previousTranslation: string
  failureReason: string
}

export async function translateAI (text: string, gameType: GameType = 'ck3', retranslationContext?: RetranslationContext, useTransliteration: boolean = false) {
  return new Promise<string>((resolve, reject) => {
    try {
      return translateAIByModel(resolve, reject, gemini('gemini-flash-lite-latest', gameType, useTransliteration), text, retranslationContext)
    } catch (e) {
      try {
        return translateAIByModel(resolve, reject, gemini('gemini-flash-latest', gameType, useTransliteration), text, retranslationContext)
      } catch (ee) {
        reject(ee)
      }
    }
  })
}

/**
 * 번역 거부 사유인지 확인
 */
function isRefusalReason(finishReason: FinishReason | undefined): boolean {
  if (!finishReason) return false
  return [
    FinishReason.SAFETY,
    FinishReason.BLOCKLIST,
    FinishReason.PROHIBITED_CONTENT,
    FinishReason.RECITATION,
    FinishReason.SPII,
  ].includes(finishReason)
}

async function translateAIByModel (resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: any) => void, model: GenerativeModel, text: string, retranslationContext?: RetranslationContext): Promise<void> {
  return addQueue(
    text,
    async () => {
      let prompt = text
      
      // 재번역 시, 이전 번역과 실패 사유를 프롬프트에 포함
      if (retranslationContext) {
        prompt = `## Retranslation Request

### Original Text
${text}

### Previous Translation (INCORRECT)
${retranslationContext.previousTranslation}

### Reason for Retranslation
${retranslationContext.failureReason}

### Instructions
Please provide a corrected translation that addresses the issue mentioned above. Remember to strictly follow all translation guidelines from the system instruction.`
      }

      try {
        const { response } = await model.generateContent(prompt)

        // 프롬프트 차단 확인
        const promptFeedback = response.promptFeedback
        if (promptFeedback?.blockReason) {
          throw new TranslationRefusedError(
            text,
            `프롬프트 차단됨: ${promptFeedback.blockReason}${promptFeedback.blockReasonMessage ? ` - ${promptFeedback.blockReasonMessage}` : ''}`
          )
        }

        // 응답 완료 사유 확인 (안전 필터, 콘텐츠 정책 등)
        const candidate = response.candidates?.[0]
        if (candidate && isRefusalReason(candidate.finishReason)) {
          throw new TranslationRefusedError(
            text,
            `응답 거부됨: ${candidate.finishReason}${candidate.finishMessage ? ` - ${candidate.finishMessage}` : ''}`
          )
        }

        const translated = response.text()
          .replaceAll(/\n/g, '\\n')
          .replaceAll(/[^\\]"/g, '\\"')
          .replaceAll(/#약(하게|화된|[화한])/g, '#weak')
          .replaceAll(/#강조/g, '#bold')

        resolve(translated)
      } catch (error) {
        // TranslationRefusedError나 다른 에러를 promise의 reject로 전달
        reject(error)
        // 큐 처리를 중단하기 위해 에러를 다시 throw
        throw error
      }
    },
  )
}
