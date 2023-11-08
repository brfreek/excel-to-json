/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
import XLSX from "xlsx";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";


const s3 = new S3Client({});
const sqsClient = new SQSClient({});

const SQS_QUEUE_URL = "https://sqs.eu-north-1.amazonaws.com/757747161455/ExcelProcessedQueue";
const ROWS_PER_ITERATION = 10000

const outputBucket = process.env.DESTINATION_BUCKETNAME;

export const handler = async (event, context) => {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    }; 
    try {
        const command = new GetObjectCommand(params);
        console.log("Start S3 Command");
        const response = await s3.send(command);
        console.log("S3 Command finished");
        try {
            const stream = response.Body;
            console.log("Create buffer from Stream");
            const buffer = await stream2buffer(stream);
            console.log("Create workbook");
            var workbook = XLSX.read(buffer);
            console.log("Convert to JSON");
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const raw_data = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            console.log("Create header row");
            const headerRow = raw_data[0];
            console.log(headerRow);

            raw_data.shift();

            const totalIterations = raw_data.length / ROWS_PER_ITERATION < 1 ? 1 : raw_data.length / ROWS_PER_ITERATION;
            
            console.log(`${raw_data.length} / ${ROWS_PER_ITERATION} = ${totalIterations}`);
            for (let i = 0; i < totalIterations; i++) {
                const startSlice = i === 0 ? 0 : i * ROWS_PER_ITERATION;
                const tmpRow = raw_data.slice(startSlice, startSlice+ROWS_PER_ITERATION);
                console.log(`Created tmp row raw_data size: ${raw_data.length}`);
                const objects = tmpRow.map((r, i, a) => {
                    let obj = {};
                    for(let it = 0; it < headerRow.length; it++){
                        let h = headerRow[it];
                        obj[h] = r[it];
                    }
                    return obj;
                });

                let data = JSON.stringify({'Sheet': objects});
    
                //write JSON back to S3 bucket
                const fileName = `/${key}/${i}.json`;
                console.log(`Output bucket: ${outputBucket}`);
                const command = new PutObjectCommand({
                    Bucket: outputBucket,
                    Key: fileName,
                    Body: data,
                });

                try {
                    const response = await s3.send(command);
                    console.log(' response: ' + response);
                    sendSQSMessage(fileName)
                } catch (err) {
                    console.error(err);
                }
            }
        } catch ( err ) {
            const message = `Error transforming Excel file ${key} from bucket ${bucket} to JSON.`;
            console.log(err.message);
            console.log(err.stack);
            const [, lineno, colno] = err.stack.match(/(\d+):(\d+)/);
            console.log('Line:', lineno);
            console.log('Column:', colno);
            throw new Error(message);  
        }
    } catch ( err ) {
        const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function. error: ${err}`;
        console.log(err.message);
        console.log(err.stack);
        const [, lineno, colno] = err.stack.match(/(\d+):(\d+)/);
        console.log('Line:', lineno);
        console.log('Column:', colno);
        throw new Error(message);  
    } 
    return "success";
};

const stream2buffer = (stream) => {

    return new Promise((resolve, reject) => {
        
        const _buf = [];

        stream.on("data", (chunk) => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", (err) => reject(err));

    });
} 

const sendSQSMessage = async (message) => {
    const command = new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        DelaySeconds: 10,
        MessageBody:
          message,
      });
    
      const response = await sqsClient.send(command);
}