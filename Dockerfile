# DOCKER-VERSION 1.3.1
FROM collingo/nodejs
MAINTAINER Nick Collings
ADD . /var/www
WORKDIR /var/www
RUN npm install
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]