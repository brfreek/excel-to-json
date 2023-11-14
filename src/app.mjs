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


const ROWS_PER_ITERATION = 10000
const OUTPUT_BUCKET = process.env.DESTINATION_BUCKETNAME;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

export const handler = async (event, context) => {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    }; 
    try {
        const command = new GetObjectCommand(params);
        const response = await s3.send(command);
        try {
            const stream = response.Body;
            const buffer = await stream2buffer(stream);
            var workbook = XLSX.read(buffer);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const raw_data = XLSX.utils.sheet_to_json(worksheet);
            const totalIterations = raw_data.length / ROWS_PER_ITERATION < 1 ? 1 : raw_data.length / ROWS_PER_ITERATION;
            for (let i = 0; i < totalIterations; i++) {
                const startSlice = i === 0 ? 0 : i * ROWS_PER_ITERATION;
                const tmpRows = raw_data.slice(startSlice, startSlice+ROWS_PER_ITERATION);                
                let data = JSON.stringify({'Sheet': tmpRows});
                //write JSON back to S3 bucket
                const fileName = `/${key}/${i}.json`;
                const command = new PutObjectCommand({
                    Bucket: OUTPUT_BUCKET,
                    Key: fileName,
                    Body: data,
                });
                try {
                    const response = await s3.send(command);
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