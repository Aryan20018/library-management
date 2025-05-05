import { app } from "./app.js";


app.get("/",(req,res)=>{
    res.send("API WORKING")
})
app.listen(process.env.PORT, ()=>{
    console.log(`server is running on ${process.env.PORT}`);
     
});