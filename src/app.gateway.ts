import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsResponse,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import Coord from './dto/Coord.interface';
import EntityDTO from './dto/EntityDTO.interface';
import GameDTO from './dto/GameDTO.interface';

@WebSocketGateway()
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger: Logger = new Logger('Gateway');

  private static SHEEP_SIZE: number = 2;
  private static SHEEP_SPEED: number = 0.25;
  private static WOLF_SIZE: number = 2 * AppGateway.SHEEP_SIZE;

  private distance(entityA: EntityDTO, entityB: EntityDTO) {
    return Math.sqrt(
      (entityA.x - entityB.x) ** 2 + (entityA.y - entityB.y) ** 2,
    );
  }

  private median(min: number, max: number, val: number) {
    return Math.max(min, Math.min(max, val));
  }

  private nearestSheep(data: GameDTO): number {
    let index = -1,
      dist = Infinity;
    data.sheeps.forEach((sheep, sheepInd) => {
      if (!sheep.dead) {
        const distBetween = this.distance(data.wolf, sheep);
        if (distBetween < dist) {
          index = sheepInd;
          dist = distBetween;
        }
      }
    });
    return index;
  }

  private directionTo(from: EntityDTO, to: EntityDTO): Coord {
    const length = this.distance(from, to);
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  }

  private moveToward(
    entity: EntityDTO,
    speed: number,
    direction: Coord,
    screen: Coord,
  ) {
    entity.x = this.median(0, screen.x, entity.x + direction.x * speed);
    entity.y = this.median(0, screen.y, entity.y + direction.y * speed);
  }

  afterInit(server: Server) {
    this.logger.log('Initalized!');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client ${client.id} connected!`);

    client.emit('initial', {
      sheepSize: AppGateway.SHEEP_SIZE,
      wolfSize: AppGateway.WOLF_SIZE,
    });
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client ${client.id} disconnected!`);
  }

  @SubscribeMessage('requestUpdate')
  handleUpdate(client: Socket, data: GameDTO): WsResponse<GameDTO> {
    const nearestSheepIndex = this.nearestSheep(data);

    //Job done
    if (nearestSheepIndex == -1) return { event: 'update', data };

    //Move wolf towards the closest sheep
    this.moveToward(
      data.wolf,
      data.wolf.speed,
      this.directionTo(data.wolf, data.sheeps[nearestSheepIndex]),
      data.screen,
    );

    for (const sheep of data.sheeps) {
      if (sheep.dead) continue;

      if (
        this.distance(data.wolf, sheep) <=
        data.wolf.size + AppGateway.SHEEP_SIZE
      ) {
        sheep.dead = true;
        data.wolf.size += 0.025;
        data.wolf.speed -= 0.015;
        continue;
      }

      this.moveToward(
        sheep,
        AppGateway.SHEEP_SPEED,
        this.directionTo(data.wolf, sheep),
        data.screen,
      );
    }

    return { event: 'update', data };
  }
}
