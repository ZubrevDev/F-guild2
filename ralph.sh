#!/bin/bash
#
# F-Guild Ralph Loop
# Запускать из ОБЫЧНОГО ТЕРМИНАЛА: bash ralph.sh
#

cd "$(dirname "$0")" || exit 1

PROMPT_FILE="ralph-prompt.md"
TASKS_FILE="tasks.json"
WAIT_ON_LIMIT=300  # 5 мин

[ -f "$PROMPT_FILE" ] || { echo "Нет $PROMPT_FILE"; exit 1; }
[ -f "$TASKS_FILE" ] || { echo "Нет $TASKS_FILE"; exit 1; }

pending() { grep -c '"status": "pending"' "$TASKS_FILE" 2>/dev/null || echo 0; }
done_count() { grep -c '"status": "done"' "$TASKS_FILE" 2>/dev/null || echo 0; }

i=1
while true; do
    p=$(pending); d=$(done_count)
    [ "$p" -eq 0 ] && { echo "Все задачи выполнены за $((i-1)) итераций."; exit 0; }

    echo ""
    echo "=== Итерация $i | done: $d | pending: $p | $(date '+%H:%M:%S') ==="

    PROMPT=$(cat "$PROMPT_FILE")
    claude --permission-mode acceptEdits -p "$PROMPT" 2>&1
    code=$?

    # Проверяем результат
    if [ $code -eq 0 ]; then
        i=$((i+1))
        continue
    fi

    # Любая ошибка — ждём и пробуем снова
    echo "[$(date '+%H:%M:%S')] Ошибка (код $code). Жду ${WAIT_ON_LIMIT}с..."
    sleep "$WAIT_ON_LIMIT"
    i=$((i+1))
done
