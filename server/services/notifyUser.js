import cron from "node-cron";

//schdules

export const notifyUser = ()=>{
    cron.schedule("*/2 * * * * *",async () => {
        console.log("Phather lawta do");
        
    })
}