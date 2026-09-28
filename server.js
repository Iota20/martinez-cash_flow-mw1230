const express = require("express");
const mysql = require("mysql2");

const app = express();
const PORT = 3000;



// Allow JSON data
app.use(express.json());


app.use(express.static(__dirname));


const db = mysql.createConnection({
    host: "127.0.0.1",
    port: 3307, //currently configured port for my device's xampp, change if needed 
    user: "root",
    password: "",
    database: "records_db"
});


db.connect((err) => {

    if (err) {
        console.error("Database connection failed:", err);
        return;
    }

    console.log("Connected to MySQL");

});


app.get("/api/summary", (req, res) => {
    const query = `
        SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
        FROM \`transaction\`
    `;

    db.query(query, (err, rows) => {
        if (err) {
            console.error("Failed to retrieve transaction summary:", err);
            return res.status(500).json({ error: "Failed to retrieve transaction summary" });
        }

        const revenue = Number(rows[0].revenue);
        const expenses = Number(rows[0].expenses);

        res.json({
            revenue,
            expenses,
            profit: revenue - expenses
        });
    });
});

app.post("/api/addTransaction", (req, res) => {
    const { transaction_title: transactionTitle, type, amount, description } = req.body ?? {};
    const numericAmount = Number(amount);
    const trimmedTitle = typeof transactionTitle === "string" ? transactionTitle.trim() : "";
    const trimmedDescription = typeof description === "string" ? description.trim() : "";

    if (!trimmedTitle || trimmedTitle.length > 15) {
        return res.status(400).json({ error: "transaction_title must be between 1 and 15 characters" });
    }

    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }

    if (!trimmedDescription || trimmedDescription.length > 255) {
        return res.status(400).json({ error: "description must be between 1 and 255 characters" });
    }

    const query = "INSERT INTO `transaction` (transaction_title, type, amount, description) VALUES (?, ?, ?, ?)";
    db.query(query, [trimmedTitle, type, numericAmount, trimmedDescription], (err, result) => {
        if (err) {
            console.error("Failed to add transaction:", err);
            return res.status(500).json({ error: "Failed to add transaction" });
        }

        res.status(201).json({
            transaction_id: result.insertId,
            transaction_title: trimmedTitle,
            type,
            amount: numericAmount,
            description: trimmedDescription
        });
    });
});

app.get("/api/transactions/search", (req, res) => {
    const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
    if (!title) {
        return res.status(400).json({ error: "title query parameter is required" });
    }

    const query = `
        SELECT transaction_id, transaction_title, type, amount, description
        FROM \`transaction\`
        WHERE transaction_title LIKE ?
        ORDER BY
            CASE
                WHEN transaction_title = ? THEN 0
                WHEN transaction_title LIKE ? THEN 1
                ELSE 2
            END,
            transaction_title ASC,
            transaction_id DESC
        LIMIT 5
    `;
    const searchPattern = `%${title}%`;
    db.query(query, [searchPattern, title, `${title}%`], (err, rows) => {
        if (err) {
            console.error("Failed to search transactions:", err);
            return res.status(500).json({ error: "Failed to search transactions" });
        }

        res.json(rows);
    });
});

app.put("/api/transactions/:id", (req, res) => {
    const transactionId = Number(req.params.id);
    const { transaction_title: transactionTitle, type, amount, description } = req.body ?? {};
    const numericAmount = Number(amount);
    const trimmedTitle = typeof transactionTitle === "string" ? transactionTitle.trim() : "";
    const trimmedDescription = typeof description === "string" ? description.trim() : "";

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: "A valid transaction id is required" });
    }
    if (!trimmedTitle || trimmedTitle.length > 15) {
        return res.status(400).json({ error: "transaction_title must be between 1 and 15 characters" });
    }
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!trimmedDescription || trimmedDescription.length > 255) {
        return res.status(400).json({ error: "description must be between 1 and 255 characters" });
    }

    const query = `
        UPDATE \`transaction\`
        SET transaction_title = ?, type = ?, amount = ?, description = ?
        WHERE transaction_id = ?
    `;
    db.query(query, [trimmedTitle, type, numericAmount, trimmedDescription, transactionId], (err, result) => {
        if (err) {
            console.error("Failed to update transaction:", err);
            return res.status(500).json({ error: "Failed to update transaction" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        res.json({
            transaction_id: transactionId,
            transaction_title: trimmedTitle,
            type,
            amount: numericAmount,
            description: trimmedDescription
        });
    });
});

app.delete("/api/transactions/:id", (req, res) => {
    const transactionId = Number(req.params.id);
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: "A valid transaction id is required" });
    }

    db.query("DELETE FROM `transaction` WHERE transaction_id = ?", [transactionId], (err, result) => {
        if (err) {
            console.error("Failed to delete transaction:", err);
            return res.status(500).json({ error: "Failed to delete transaction" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        res.json({ message: "Transaction deleted", transaction_id: transactionId });
    });
});







app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});