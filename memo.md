curl -X POST http://localhost:8787/query -H "Content-Type: application/json" -d '{"sql": "SELECT * from stock_db.prices limit 2"}'

curl -X POST http://localhost:8787/query -H "Content-Type: application/json" -d "{\"sql\": \"SELECT * from stock_db.companies where name like '%トヨタ%'\"}"

curl -X POST http://localhost:8786/ -H "Content-Type: application/json" -d '{"question":"ラクーンの株価を教えて"}'