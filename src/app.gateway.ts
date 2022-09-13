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
  private static SHEEP_COUNT: number = 100;
  private static WOLF_SIZE: number = 1.25 * AppGateway.SHEEP_SIZE;
  private static WOLF_SPEED: number = 3;

  private game: GameDTO;

  private distance(entityA: EntityDTO, entityB: EntityDTO) {
    return Math.sqrt(
      (entityA.x - entityB.x) ** 2 + (entityA.y - entityB.y) ** 2,
    );
  }

  private median(min: number, max: number, val: number) {
    return Math.max(min, Math.min(max, val));
  }

  //Returns the index of the nearest sheep from the wolf
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

  //Moving entities while respecting screen borders
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

    //Receiving information from client like canvas size
    const query = client.handshake.query;
    const screen: Coord = {
      x: parseInt(query.width as string),
      y: parseInt(query.height as string),
    };

    //Create the simulation, spawn wolf and sheeps

    this.game = {
      screen,
      wolf: {
        x: screen.x / 2,
        y: screen.y / 2,
        speed: AppGateway.WOLF_SPEED,
        size: AppGateway.WOLF_SIZE,
      },
      sheeps: [],
    };

    for (let i = 0; i < AppGateway.SHEEP_COUNT; i++) {
      this.game.sheeps.push({
        x: Math.random() * screen.x,
        y: Math.random() * screen.y,
        dead: false,
      });
    }

    //Sending initial information to the client

    client.emit('initial', {
      sheepSize: AppGateway.SHEEP_SIZE,
      wolfSize: AppGateway.WOLF_SIZE,
      sheepCount: AppGateway.SHEEP_COUNT,
      game: this.game,
    });
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client ${client.id} disconnected!`);

    this.game.sheeps = [];
  }

  @SubscribeMessage('requestUpdate')
  handleUpdate(client: Socket): WsResponse<GameDTO> {
    const data = this.game;
    const nearestSheepIndex = this.nearestSheep(data);

    //Job done
    if (nearestSheepIndex == -1) return { event: 'update', data };

    const wolf = data.wolf;

    //Move wolf towards the closest sheep
    this.moveToward(
      wolf,
      wolf.speed,
      this.directionTo(wolf, data.sheeps[nearestSheepIndex]),
      data.screen,
    );

    const sheeps = data.sheeps;

    for (let ind = 0; ind < sheeps.length; ind++) {
      //Check if sheep is too close to the wolf
      if (
        this.distance(data.wolf, sheeps[ind]) <=
        wolf.size + AppGateway.SHEEP_SIZE
      ) {
        wolf.size += 0.25;
        wolf.speed -= 0.025;
        sheeps.splice(ind, 1);
        ind--;
        continue;
      }

      //Move the sheep
      this.moveToward(
        sheeps[ind],
        AppGateway.SHEEP_SPEED,
        this.directionTo(wolf, sheeps[ind]),
        data.screen,
      );
    }

    return { event: 'update', data };
  }
}
