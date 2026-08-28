import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder().setTitle("cs2market").setVersion("1.0").build();
  SwaggerModule.setup('docs', app, ()=>SwaggerModule.createDocument(app, config))

  // Lets DatabaseModule.onModuleDestroy run on SIGINT/SIGTERM.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
