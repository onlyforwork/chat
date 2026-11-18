import { useEffect, useState, useRef, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { joinRoom } from 'trystero'

const APP_ID = 'trystero-react-vite-ts-demo-001'
const ROOM_ID = 'ts-test-room-01'

type Room = ReturnType<typeof joinRoom>

type ChatMsg = {
    peerId: string
    text: string
    self: boolean
}

// 串行化 leave -> join：StrictMode 下 effect 会 mount/unmount/mount，
// 0.27+ 对同一 room 重复 joinRoom 会抛错，所以必须等上一次 leave 完成
let leaving: Promise<unknown> = Promise.resolve()

export default function TrysteroDemo() {
    const [myColor, setMyColor] = useState('#ff0000')
    const [peerColors, setPeerColors] = useState<Record<string, string>>({})
    const [msgList, setMsgList] = useState<ChatMsg[]>([])
    const [inputMsg, setInputMsg] = useState('')

    const myColorRef = useRef(myColor)
    const roomRef = useRef<Room | null>(null)
    const sendRef = useRef<{
        sendColor: ((c: string) => void) | null
        sendChat: ((txt: string) => void) | null
    }>({ sendColor: null, sendChat: null })

    useEffect(() => {
        let cancelled = false
        const offs: Array<() => void> = []

        leaving.then(() => {
            if (cancelled) return

            const room = joinRoom({ appId: APP_ID }, ROOM_ID)
            roomRef.current = room

            const colorAction = room.makeAction<string>('color')
            const chatAction = room.makeAction<string>('chat')

            // onMessage(handler) -> 返回 unsubscribe；handler 签名 (data, { peerId, userId })
            offs.push(
                colorAction.onMessage((color, { peerId }) => {
                    setPeerColors(prev => ({ ...prev, [peerId]: color }))
                }),
            )
            offs.push(
                chatAction.onMessage((text, { peerId }) => {
                    setMsgList(prev => [...prev, { peerId, text, self: false }])
                }),
            )

            // 新 peer 加入：把我当前的颜色单独发给它
            offs.push(
                room.onPeerJoin(({ peerId }) => {
                    colorAction
                        .send(myColorRef.current, { target: peerId })
                        .catch(() => {})
                }),
            )
            offs.push(
                room.onPeerLeave(({ peerId }) => {
                    setPeerColors(prev => {
                        const next = { ...prev }
                        delete next[peerId]
                        return next
                    })
                }),
            )

            sendRef.current.sendColor = c => {
                colorAction.send(c).catch(() => {})
            }
            sendRef.current.sendChat = txt => {
                chatAction.send(txt).catch(() => {})
            }
        })

        return () => {
            cancelled = true
            offs.forEach(off => off())
            sendRef.current = { sendColor: null, sendChat: null }
            const room = roomRef.current
            roomRef.current = null
            if (room) {
                leaving = Promise.resolve(room.leave()).catch(() => {})
            }
        }
    }, [])

    const handleColorChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const c = e.target.value
        setMyColor(c)
        myColorRef.current = c
        sendRef.current.sendColor?.(c)
    }, [])

    const handleSendChat = useCallback(() => {
        const text = inputMsg.trim()
        if (!text) return
        sendRef.current.sendChat?.(text)
        setMsgList(prev => [...prev, { peerId: 'me', text, self: true }])
        setInputMsg('')
    }, [inputMsg])

    const onKeyEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSendChat()
    }

    return (
        <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
            <h2>Trystero TS Demo</h2>
            <p>同一个 RoomId，使用无痕窗口测试</p>

            <div style={{ margin: '16px 0' }}>
                <label>我的颜色：</label>
                <input type="color" value={myColor} onChange={handleColorChange} />
            </div>

            <div>
                <h4>在线Peer颜色</h4>
                <ul>
                    {Object.entries(peerColors).map(([pid, c]) => (
                        <li key={pid} style={{ background: c, padding: 4 }}>
                            {pid}: {c}
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ marginTop: 20 }}>
                <h4>聊天</h4>
                <div
                    style={{
                        height: 180,
                        border: '1px solid #ccc',
                        overflowY: 'auto',
                        padding: 8,
                    }}
                >
                    {msgList.map((m, i) => (
                        <div key={i} style={{ textAlign: m.self ? 'right' : 'left' }}>
                            {m.self ? '我' : m.peerId}: {m.text}
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 8 }}>
                    <input
                        value={inputMsg}
                        onChange={e => setInputMsg(e.target.value)}
                        onKeyDown={onKeyEnter}
                        placeholder="输入消息"
                        style={{ width: 300 }}
                    />
                    <button onClick={handleSendChat} style={{ marginLeft: 8 }}>
                        发送
                    </button>
                </div>
            </div>
        </div>
    )
}