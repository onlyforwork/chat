import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { joinRoom } from 'trystero'

const APP_ID = 'trystero-react-vite-ts-demo-001'
const MAX_USERS = 2

type Room = ReturnType<typeof joinRoom>

type ChatMsg = {
    peerId: string
    text: string
    self: boolean
}

let leaving: Promise<unknown> = Promise.resolve()

export default function TrysteroDemo() {
    const [roomIdInput, setRoomIdInput] = useState('ts-test-room-01')
    const [passwordInput, setPasswordInput] = useState('')
    const [activeRoom, setActiveRoom] = useState<{
        roomId: string
        password: string
    } | null>(null)

    const [msgList, setMsgList] = useState<ChatMsg[]>([])
    const [inputMsg, setInputMsg] = useState('')
    const [status, setStatus] = useState('尚未加入房间')
    const [peerIds, setPeerIds] = useState<string[]>([])

    const roomRef = useRef<Room | null>(null)
    const sendChatRef = useRef<((text: string) => void) | null>(null)

    useEffect(() => {
        if (!activeRoom) return

        let cancelled = false
        let room: Room | null = null
        const offs: Array<() => void> = []

        setStatus('正在加入房间…')
        setMsgList([])
        setPeerIds([])

        leaving = leaving.then(() => {
            if (cancelled) return

            room = joinRoom(
                {
                    appId: APP_ID,
                    password: activeRoom.password,
                    maxUsers: MAX_USERS,
                },
                activeRoom.roomId,
            )

            roomRef.current = room

            const chatAction = room.makeAction<string>('chat')

            offs.push(
                chatAction.onMessage((text, { peerId }) => {
                    setMsgList(prev => [...prev, { peerId, text, self: false }])
                }),
            )

            offs.push(
                room.onPeerJoin(({ peerId }) => {
                    setPeerIds(prev =>
                        prev.includes(peerId) ? prev : [...prev, peerId],
                    )
                    setStatus('已加入房间')
                }),
            )

            offs.push(
                room.onPeerLeave(({ peerId }) => {
                    setPeerIds(prev => prev.filter(id => id !== peerId))
                }),
            )

            sendChatRef.current = text => {
                chatAction.send(text).catch(() => {})
            }

            setStatus('已加入房间，等待其他玩家…')
        }).catch(error => {
            setStatus(`加入失败：${String(error)}`)
        })

        return () => {
            cancelled = true
            offs.forEach(off => off())
            sendChatRef.current = null

            if (room && roomRef.current === room) {
                roomRef.current = null
                leaving = Promise.resolve(room.leave()).catch(() => {})
            }
        }
    }, [activeRoom])

    const handleJoin = () => {
        const roomId = roomIdInput.trim()
        const password = passwordInput

        if (!roomId) {
            setStatus('请填写房间号')
            return
        }

        if (!password) {
            setStatus('请填写房间密码')
            return
        }

        setActiveRoom({ roomId, password })
    }

    const handleLeave = () => {
        setActiveRoom(null)
        setStatus('已离开房间')
        setPeerIds([])
        setMsgList([])
    }

    const handleSendChat = () => {
        const text = inputMsg.trim()
        if (!text || !roomRef.current) return

        sendChatRef.current?.(text)
        setMsgList(prev => [...prev, { peerId: 'me', text, self: true }])
        setInputMsg('')
    }

    const onKeyEnter = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') handleSendChat()
    }

    return (
        <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
            <h2>Trystero 聊天 Demo</h2>

            <div style={{ display: 'grid', gap: 8, margin: '16px 0' }}>
                <label>
                    房间号：
                    <input
                        value={roomIdInput}
                        onChange={event => setRoomIdInput(event.target.value)}
                        disabled={!!activeRoom}
                    />
                </label>

                <label>
                    房间密码：
                    <input
                        type="password"
                        value={passwordInput}
                        onChange={event => setPasswordInput(event.target.value)}
                        disabled={!!activeRoom}
                    />
                </label>

                <div>
                    {!activeRoom ? (
                        <button onClick={handleJoin}>加入房间</button>
                    ) : (
                        <button onClick={handleLeave}>离开房间</button>
                    )}
                </div>
            </div>

            <p>状态：{status}</p>
            <p>
                在线人数：{activeRoom ? peerIds.length + 1 : 0} / {MAX_USERS}
            </p>

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
                    {msgList.map((message, index) => (
                        <div
                            key={index}
                            style={{
                                textAlign: message.self ? 'right' : 'left',
                            }}
                        >
                            {message.self ? '我' : message.peerId}:{' '}
                            {message.text}
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 8 }}>
                    <input
                        value={inputMsg}
                        onChange={event => setInputMsg(event.target.value)}
                        onKeyDown={onKeyEnter}
                        placeholder="输入消息"
                        disabled={!activeRoom}
                        style={{ width: 300 }}
                    />
                    <button
                        onClick={handleSendChat}
                        disabled={!activeRoom}
                        style={{ marginLeft: 8 }}
                    >
                        发送
                    </button>
                </div>
            </div>
        </div>
    )
}