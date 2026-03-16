const fs = require("fs");
const data = require("./database.json");

let customers = [];

for (let i = 1; i <= 250; i++) {

    let bankNumber = Math.ceil(i / 50);   // assigns 50 customers per bank

    customers.push({
        customerId: "C" + String(i).padStart(3, "0"),
        bankId: "B" + bankNumber,
        name: "Customer" + i,
        tenure: Math.floor(Math.random() * 60) + 1,
        monthlyCharges: Math.floor(Math.random() * 100) + 20,
        contractType: ["month-to-month", "one-year", "two-year"][Math.floor(Math.random() * 3)],
        supportCalls: Math.floor(Math.random() * 5)
    });

}

data.customers = customers;

fs.writeFileSync("database.json", JSON.stringify(data, null, 2));

console.log("250 customers generated successfully!");