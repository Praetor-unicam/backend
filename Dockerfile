FROM node:12

# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# default to port 5000 for node
ARG PORT=5000
ENV PORT $PORT
EXPOSE $PORT

RUN apt-get update
RUN apt-get install firefox-esr -y
RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.26.0/geckodriver-v0.26.0-linux64.tar.gz
RUN tar xf geckodriver-v0.26.0-linux64.tar.gz
RUN cp geckodriver /usr/bin/
RUN chmod +x /usr/bin/geckodriver

CMD [ "ts-node","--transpile-only", "src/index.ts" ]